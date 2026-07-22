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


def log_step_code(prefix, sleep_ms):
  # Inserts a start row, sleeps, inserts an end row into "books" (reused as
  # a scratch log, avoiding the need to build a table over HTTP).
  return (
    'const table = Table.findOne({name: "books"});\n'
    f'await table.insertRow({{author: "{prefix}-start", pages: 0}});\n'
    f'await sleep({sleep_ms});\n'
    f'await table.insertRow({{author: "{prefix}-end", pages: 0}});\n'
  )


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
    # redirect_url looks like /actions/configure/<trigger_id>
    trigger_id = self.sess1.redirect_url.rstrip('/').split('/')[-1]
    assert trigger_id.isdigit(), self.sess1.redirect_url
    return trigger_id

  def _add_step(self, trigger_id, fields):
    self.sess1.get(f'/actions/stepedit/{trigger_id}')
    fields = dict(fields)
    fields['_csrf'] = self.sess1.csrf()
    self.sess1.postForm(f'/actions/stepedit/{trigger_id}', fields)
    assert self.sess1.status == 302, self.sess1.content

  def _fire_testrun(self, sess, trigger_id, results, key):
    sess.get(f'/actions/testrun/{trigger_id}')
    results[key] = (sess.status, sess.content)

  def _markers(self, prefix):
    out = SaltcornSession.cli(
      "run-sql",
      "--sql",
      f"select author from books where author like '{prefix}-%' order by id",
    )
    return re.findall(rf"'({re.escape(prefix)}-(?:start|end))'", out)

  # testrun always redirects (302), even if a step failed, so check the
  # run's stored status instead of the HTTP response.
  def _error_run_count(self, trigger_id, message_substring):
    out = SaltcornSession.cli(
      "run-sql",
      "--sql",
      "select 'COUNT_RESULT:' || count(*) as result from _sc_workflow_runs "
      f"where trigger_id = {trigger_id} and status = 'Error' "
      f"and error like '%{message_substring}%'",
    )
    m = re.search(r"COUNT_RESULT:(\d+)", out)
    assert m, f"could not parse count from run-sql output: {out}"
    return int(m.group(1))

  # Without a lock, concurrent runs should overlap - proving the markers
  # setup can actually tell locked from unlocked (used as the baseline for
  # the AcquireLock/ReleaseLock test below).
  def test_without_lock_interleaves(self):
    prefix = 'nolock'
    trigger_id = self._create_trigger('mutex_test_no_lock_wf')
    self._add_step(trigger_id, {
      'wf_step_name': 'unlocked_step',
      'wf_action_name': 'run_js_code',
      'wf_initial_step': 'on',
      'wf_only_if': '',
      'wf_next_step': '',
      'code': log_step_code(prefix, 1500),
      'run_where': 'Server',
    })

    results = {}
    t1 = threading.Thread(
      target=self._fire_testrun, args=(self.sess1, trigger_id, results, 's1')
    )
    t2 = threading.Thread(
      target=self._fire_testrun, args=(self.sess2, trigger_id, results, 's2')
    )
    t1.start()
    t2.start()
    t1.join(timeout=30)
    t2.join(timeout=30)

    assert results['s1'][0] == 302, results['s1'][1]
    assert results['s2'][0] == 302, results['s2'][1]

    markers = self._markers(prefix)
    logger.info(f"[{prefix}] marker sequence: {markers}")
    assert markers == [
      f'{prefix}-start', f'{prefix}-start', f'{prefix}-end', f'{prefix}-end'
    ], (
      f"expected interleaved start,start,end,end (no lock) but got {markers} "
      "- if this is serialized, something other than the mutex feature is "
      "serializing these requests, which would undermine the positive test above"
    )

  # TEST: run-scoped lock (AcquireLock ... ReleaseLock step pair) held
  # across an intervening step, serializing concurrent runs.
  def test_run_scoped_acquire_release_serializes_across_nodes(self):
    prefix = 'runlock'
    lock_name = 'runlock-shared-lock'
    trigger_id = self._create_trigger('mutex_test_run_scope_wf')
    self._add_step(trigger_id, {
      'wf_step_name': 'acquire',
      'wf_action_name': 'AcquireLock',
      'wf_initial_step': 'on',
      'wf_only_if': '',
      'wf_next_step': 'log',
      'lock_name': f'"{lock_name}"',
    })
    self._add_step(trigger_id, {
      'wf_step_name': 'log',
      'wf_action_name': 'run_js_code',
      'wf_initial_step': '',
      'wf_only_if': '',
      'wf_next_step': 'release',
      'code': log_step_code(prefix, 1500),
      'run_where': 'Server',
    })
    self._add_step(trigger_id, {
      'wf_step_name': 'release',
      'wf_action_name': 'ReleaseLock',
      'wf_initial_step': '',
      'wf_only_if': '',
      'wf_next_step': '',
      'lock_name': f'"{lock_name}"',
    })

    results = {}
    t1 = threading.Thread(
      target=self._fire_testrun, args=(self.sess1, trigger_id, results, 's1')
    )
    t2 = threading.Thread(
      target=self._fire_testrun, args=(self.sess2, trigger_id, results, 's2')
    )
    t1.start()
    t2.start()
    t1.join(timeout=30)
    t2.join(timeout=30)

    assert results['s1'][0] == 302, results['s1'][1]
    assert results['s2'][0] == 302, results['s2'][1]

    markers = self._markers(prefix)
    logger.info(f"[{prefix}] marker sequence: {markers}")
    assert markers == [
      f'{prefix}-start', f'{prefix}-end', f'{prefix}-start', f'{prefix}-end'
    ], f"expected serialized start,end,start,end but got {markers}"

  # The first run holds the lock for 4s. The second starts 1s later with
  # a 1s timeout, so it should fail instead of waiting.
  def test_acquire_lock_timeout_fails_second_run(self):
    prefix = 'timeoutlock'
    lock_name = 'timeoutlock-shared-lock'
    trigger_id = self._create_trigger('mutex_test_timeout_wf')
    self._add_step(trigger_id, {
      'wf_step_name': 'acquire',
      'wf_action_name': 'AcquireLock',
      'wf_initial_step': 'on',
      'wf_only_if': '',
      'wf_next_step': 'log',
      'lock_name': f'"{lock_name}"',
      'lock_timeout': '1',
    })
    self._add_step(trigger_id, {
      'wf_step_name': 'log',
      'wf_action_name': 'run_js_code',
      'wf_initial_step': '',
      'wf_only_if': '',
      'wf_next_step': 'release',
      'code': log_step_code(prefix, 4000),
      'run_where': 'Server',
    })
    self._add_step(trigger_id, {
      'wf_step_name': 'release',
      'wf_action_name': 'ReleaseLock',
      'wf_initial_step': '',
      'wf_only_if': '',
      'wf_next_step': '',
      'lock_name': f'"{lock_name}"',
    })

    results = {}
    t1 = threading.Thread(
      target=self._fire_testrun, args=(self.sess1, trigger_id, results, 'first')
    )
    t1.start()
    time.sleep(1)  # let the first run acquire the lock and start its 4s sleep
    t2 = threading.Thread(
      target=self._fire_testrun, args=(self.sess2, trigger_id, results, 'second')
    )
    t2.start()
    t1.join(timeout=30)
    t2.join(timeout=30)

    # both requests redirect (302) regardless of outcome - the workflow
    # engine swallows the second run's step error internally rather than
    # raising it through the route, so check its stored status instead
    assert results['first'][0] == 302, results['first'][1]
    assert results['second'][0] == 302, results['second'][1]

    error_count = self._error_run_count(trigger_id, 'lock timeout')
    assert error_count == 1, (
      f"expected exactly one run of trigger {trigger_id} to have errored "
      f"with a lock timeout, found {error_count}"
    )

    markers = self._markers(prefix)
    logger.info(f"[{prefix}] marker sequence: {markers}")
    assert markers == [f'{prefix}-start', f'{prefix}-end'], (
      f"expected only the first run's start/end (the second should have "
      f"been blocked before it ran) but got {markers}"
    )
