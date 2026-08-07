import re
import time
import threading
import logging
from scsession import SaltcornSession

logging.basicConfig(
  level=logging.INFO,
  format='[%(asctime)s] %(levelname)s - %(message)s',
  datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)

email = 'admin@foo.com'
password = 'AhGGr6rhu45'


def login(sess):
  sess.get('/auth/login')
  sess.postForm('/auth/login', {
    'email': email,
    'password': password,
    '_csrf': sess.csrf(),
  })


class Test:
  def setup_class(self):
    SaltcornSession.reset_to_fixtures()
    self.sess1 = SaltcornSession(port=3001, env_vars={
        "SALTCORN_MULTI_NODE": True,
    }, pipe_output=True)
    self.sess2 = SaltcornSession(port=3002, env_vars={
        "SALTCORN_MULTI_NODE": True,
    }, pipe_output=True)
    login(self.sess1)
    login(self.sess2)

  def teardown_class(self):
    self.sess1.close()
    self.sess2.close()

  # --- helpers ---------------------------------------------------------

  def _create_trigger(self, name):
    self.sess1.get('/actions/new')
    self.sess1.postForm('/actions/new', {
      'name': name,
      'when_trigger': 'Never',
      'table_id': '',
      'action': 'Workflow',
      'description': '',
      '_csrf': self.sess1.csrf(),
    })
    assert self.sess1.status == 302, self.sess1.content
    trigger_id = self.sess1.redirect_url.rstrip('/').split('/')[-1]
    assert trigger_id.isdigit(), self.sess1.redirect_url
    return trigger_id

  def _add_step(self, trigger_id, fields):
    self.sess1.get(f'/actions/stepedit/{trigger_id}')
    fields = dict(fields)
    fields['_csrf'] = self.sess1.csrf()
    self.sess1.postForm(f'/actions/stepedit/{trigger_id}', fields)
    assert self.sess1.status == 302, self.sess1.content

  def _js_step(self, trigger_id, code):
    self._add_step(trigger_id, {
      'wf_step_name': 'js',
      'wf_action_name': 'run_js_code',
      'wf_initial_step': 'on',
      'wf_only_if': '',
      'wf_next_step': '',
      'code': code,
      'run_where': 'Server',
    })

  def _fire_testrun(self, sess, trigger_id, results, key):
    sess.get(f'/actions/testrun/{trigger_id}')
    results[key] = (sess.status, sess.content)

  def _markers(self, prefix):
    out = SaltcornSession.cli(
      "run-sql",
      "--sql",
      f"select author from books where author like '{prefix}-%' order by id",
    )
    # the cli echoes the query itself, which also contains '{prefix}-%' -
    # drop that literal match, it's not a row
    found = re.findall(rf"'({re.escape(prefix)}-[^']*)'", out)
    return [m for m in found if m != f'{prefix}-%']

  # --- tests -------------------------------------------------------------

  # A handle registered on one node receives a message sent from a
  # different node while it's waiting - proving delivery actually crosses
  # processes, not just a same-process Map lookup.
  def test_message_reaches_handle_on_another_node(self):
    prefix = 'nodehandle-recv'
    handle_id = 'test-handle-recv'
    receiver_trigger = self._create_trigger('node_handle_receiver_wf')
    self._js_step(receiver_trigger, (
      'const table = Table.findOne({name: "books"});\n'
      'let received;\n'
      f'const unregister = registerNodeHandle("{handle_id}", (payload) => {{\n'
      '  received = payload;\n'
      '});\n'
      'await sleep(2000);\n'
      'unregister();\n'
      f'await table.insertRow({{author: "{prefix}-" + JSON.stringify(received), pages: 0}});\n'
    ))

    sender_trigger = self._create_trigger('node_handle_sender_wf')
    self._js_step(sender_trigger, (
      'await sleep(500);\n'
      f'sendToNodeHandle("{handle_id}", {{hello: "world"}});\n'
    ))

    results = {}
    t_recv = threading.Thread(
      target=self._fire_testrun,
      args=(self.sess1, receiver_trigger, results, 'recv'),
    )
    t_send = threading.Thread(
      target=self._fire_testrun,
      args=(self.sess2, sender_trigger, results, 'send'),
    )
    t_recv.start()
    t_send.start()
    t_recv.join(timeout=15)
    t_send.join(timeout=15)

    assert results['recv'][0] == 302, results['recv'][1]
    assert results['send'][0] == 302, results['send'][1]

    markers = self._markers(prefix)
    logger.info(f"[{prefix}] marker: {markers}")
    assert markers == [f'{prefix}-{{"hello":"world"}}'], (
      f"expected the payload sent from the other node, but got {markers}"
    )

  # Once the handle is unregistered, a message sent for the same id should
  # be a silent no-op instead of reaching a stale/removed handler.
  def test_message_after_unregister_is_a_noop(self):
    prefix = 'nodehandle-stale'
    handle_id = 'test-handle-stale'
    receiver_trigger = self._create_trigger('node_handle_stale_receiver_wf')
    self._js_step(receiver_trigger, (
      'const table = Table.findOne({name: "books"});\n'
      'let received = "untouched";\n'
      f'const unregister = registerNodeHandle("{handle_id}", (payload) => {{\n'
      '  received = payload;\n'
      '});\n'
      'unregister();\n'
      'await sleep(1500);\n'
      f'await table.insertRow({{author: "{prefix}-" + JSON.stringify(received), pages: 0}});\n'
    ))

    sender_trigger = self._create_trigger('node_handle_stale_sender_wf')
    self._js_step(sender_trigger, (
      'await sleep(500);\n'
      f'sendToNodeHandle("{handle_id}", {{hello: "too-late"}});\n'
    ))

    results = {}
    t_recv = threading.Thread(
      target=self._fire_testrun,
      args=(self.sess1, receiver_trigger, results, 'recv'),
    )
    t_send = threading.Thread(
      target=self._fire_testrun,
      args=(self.sess2, sender_trigger, results, 'send'),
    )
    t_recv.start()
    t_send.start()
    t_recv.join(timeout=15)
    t_send.join(timeout=15)

    assert results['recv'][0] == 302, results['recv'][1]
    assert results['send'][0] == 302, results['send'][1]

    markers = self._markers(prefix)
    logger.info(f"[{prefix}] marker: {markers}")
    assert markers == [f'{prefix}-"untouched"'], (
      f"message arrived after unregister - expected a no-op, got {markers}"
    )
