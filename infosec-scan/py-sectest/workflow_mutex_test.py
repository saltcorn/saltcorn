import re
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

LOCK_NAME = 'mutex-test-shared-lock'
START_MARKER = 'mutex-test-start'
END_MARKER = 'mutex-test-end'

# Logs start/end rows into "books" (reused as a scratch log) around a sleep.
# Serialized: start,end,start,end. Interleaved (mutex failed): start,start,end,end.
STEP_CODE = (
  'const table = Table.findOne({name: "books"});\n'
  f'await table.insertRow({{author: "{START_MARKER}", pages: 0}});\n'
  'await sleep(1500);\n'
  f'await table.insertRow({{author: "{END_MARKER}", pages: 0}});\n'
)


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

  def teardown_class(self):
    self.sess1.close()
    self.sess2.close()

  # Create a "Never" workflow trigger with a single run_js_code step that
  # has a "Lock name" set (step-scoped mutex, models/mutex.ts withLock).
  # Returns the new trigger's id.
  def _create_locked_workflow(self):
    logger.info("Creating workflow trigger")
    self.sess1.get('/actions/new')
    self.sess1.postForm('/actions/new', {
      'name': 'mutex_test_wf',
      'when_trigger': 'Never',
      'table_id': '',
      'action': 'Workflow',
      'description': '',
      '_csrf': self.sess1.csrf(),
    })
    assert self.sess1.status == 302, self.sess1.content
    # redirect_url looks like /actions/configure/<trigger_id>
    trigger_id = self.sess1.redirect_url.rstrip('/').split('/')[-1]
    assert trigger_id.isdigit(), self.sess1.redirect_url

    logger.info(f"Adding locked step to trigger {trigger_id}")
    self.sess1.get(f'/actions/stepedit/{trigger_id}')
    self.sess1.postForm(f'/actions/stepedit/{trigger_id}', {
      'wf_step_name': 'locked_step',
      'wf_action_name': 'run_js_code',
      'wf_initial_step': 'on',
      'wf_only_if': '',
      'wf_next_step': '',
      'mutex_enabled': 'on',
      'mutex_lock_name': f'"{LOCK_NAME}"',
      'code': STEP_CODE,
      'run_where': 'Server',
      '_csrf': self.sess1.csrf(),
    })
    assert self.sess1.status == 302, self.sess1.content

    return trigger_id

  def _run_count(self):
    out = SaltcornSession.cli(
      "run-sql",
      "--sql",
      f"select author from books where author like 'mutex-test-%' order by id",
    )
    return re.findall(r"'(mutex-test-(?:start|end))'", out)

  # TEST:
  # fire the same locked workflow concurrently from two separate node
  # processes (sharing one database) and check that their critical
  # sections did not interleave.
  def test_step_scoped_lock_serializes_across_nodes(self):
    logger.info("sess1 and sess2 logging in")
    login(self.sess1)
    login(self.sess2)

    trigger_id = self._create_locked_workflow()

    results = {}

    def fire(sess, key):
      sess.get(f'/actions/testrun/{trigger_id}')
      results[key] = sess.status

    t1 = threading.Thread(target=fire, args=(self.sess1, 'sess1'))
    t2 = threading.Thread(target=fire, args=(self.sess2, 'sess2'))
    t1.start()
    t2.start()
    t1.join(timeout=30)
    t2.join(timeout=30)

    assert results.get('sess1') == 302, self.sess1.content
    assert results.get('sess2') == 302, self.sess2.content

    markers = self._run_count()
    logger.info(f"Observed marker sequence: {markers}")
    assert len(markers) == 4, markers
    assert markers == [START_MARKER, END_MARKER, START_MARKER, END_MARKER], (
      f"expected serialized start,end,start,end but got {markers} - "
      "this would mean the two nodes' locked steps interleaved"
    )
