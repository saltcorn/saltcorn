import re
import time
import json
from urllib.parse import urljoin
import socketio

# embedded by sendRestoreWaitPage in packages/server/auth/routes.ts
JOBID_RE = re.compile(r'const jobId = "([0-9a-f-]{36})"')


class RestoreBackupClient:
  """
  Drives the create-first-user backup-restore flow against an already
  running SaltcornSession: uploads a backup, then tracks progress either
  over the restore_progress socket room or by polling
  /auth/restore_status/:jobId, mirroring what the browser's wait page does.
  """

  def __init__(self, session):
    self.http = session
    self.job_id = None
    self.messages = []
    self.join_ack = None
    self.sio = None

  def upload_backup(self, backup_path):
    self.http.get('/auth/create_first_user')
    assert self.http.status == 200
    assert "Create first user" in self.http.content
    with open(backup_path, 'rb') as f:
      resp = self.http.session.post(
        urljoin(self.http.base_url, '/auth/create_from_restore'),
        data={'_csrf': self.http.csrf()},
        files={'file': ('backup.zip', f, 'application/zip')},
      )
    assert resp.status_code == 200
    m = JOBID_RE.search(resp.text)
    assert m, "jobId not found on the restore wait page"
    self.job_id = m.group(1)
    return self.job_id

  def connect_socket(self):
    sio = socketio.Client()

    @sio.event
    def restore_progress(data):
      self.messages.append(data)

    @sio.event
    def test_conn_msg(data):
      self.messages.append({"status": "__test_conn_msg__"})

    # same cookie a real (anonymous, pre-login) browser tab would send
    auth_headers = 'connect.sid=' + self.http.sessionID()
    sio.connect(self.http.base_url, transports=["websocket"],
                headers={'cookie': auth_headers})
    self.sio = sio

  def join_restore_room(self):
    ack = {}

    def cb(a):
      ack.update(a or {})

    self.sio.emit("join_restore_room", self.job_id, callback=cb)
    time.sleep(0.3)
    self.join_ack = ack
    return ack

  def disconnect(self):
    if self.sio is not None:
      self.sio.disconnect()

  def wait_for_status(self, status, timeout=30):
    """poll the socket-collected messages for a given terminal status"""
    deadline = time.time() + timeout
    while time.time() < deadline:
      if any(m.get("status") == status for m in self.messages):
        return True
      time.sleep(0.5)
    return False

  def poll_status(self):
    """hits the same endpoint the browser's polling fallback uses"""
    self.http.get(f'/auth/restore_status/{self.job_id}')
    assert self.http.status == 200
    return json.loads(self.http.content)

  def wait_for_poll_status(self, status, timeout=30):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
      last = self.poll_status()
      if last.get("status") == status:
        return last
      time.sleep(1)
    raise AssertionError(f"polling never reached status={status!r}, last={last}")
