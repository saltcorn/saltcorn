from scsession import SaltcornSession
from restore_backup_client import RestoreBackupClient
import os
import time

BACKUP_PATH = os.path.join(
  os.path.dirname(os.path.realpath(__file__)),
  "..", "..", "deploy", "playwright_mobile", "backups", "guitars_backup.zip"
)


class TestCreateFirstUserRestore:
  def setup_class(self):
    # reset-schema without fixtures() leaves zero users, which is what
    # makes /auth/create_first_user reachable
    SaltcornSession.cli("reset-schema", "-f")
    self.sess = SaltcornSession(port=3001)

  def teardown_class(self):
    self.sess.close()

  def test_create_first_user_screen_shown(self):
    self.sess.reset()
    self.sess.get('/auth/create_first_user')
    assert self.sess.status == 200
    assert "Create first user" in self.sess.content
    assert "Restore a backup" in self.sess.content

  def test_restore_backup_over_socket(self):
    self.sess.reset()
    client = RestoreBackupClient(self.sess)
    client.upload_backup(BACKUP_PATH)
    client.connect_socket()
    try:
      ack = client.join_restore_room()
      assert ack.get("status") == "ok"
      assert client.wait_for_status("done", timeout=30), (
        f"restore did not complete over the socket, got: {client.messages}"
      )
      assert any(m.get("status") == "progress" for m in client.messages), (
        "expected at least one progress line before done"
      )
    finally:
      client.disconnect()

    # the backup contains its own users, so the create-first-user screen
    # is no longer reachable
    self.sess.get('/auth/create_first_user')
    assert self.sess.status == 302
    assert self.sess.redirect_url == '/auth/login'

  def test_restore_status_rejects_path_traversal(self):
    self.sess.reset()
    self.sess.get('/auth/restore_status/' + '..%2F..%2F..%2Fetc%2Fpasswd')
    assert self.sess.status == 200
    assert '"error"' in self.sess.content
    assert "Unknown job" in self.sess.content


class TestRestorePollingFallback:
  """Simulates a broken socket connection to test the polling fallback. """

  def setup_class(self):
    SaltcornSession.cli("reset-schema", "-f")
    self.sess = SaltcornSession(port=3002)

  def teardown_class(self):
    self.sess.close()

  def test_polling_reaches_done_when_socket_is_silent(self):
    self.sess.reset()
    client = RestoreBackupClient(self.sess)
    client.upload_backup(BACKUP_PATH)

    # connect, but deliberately never join the room - this is exactly
    # what the browser's 5s fallback timer is watching for
    client.connect_socket()
    try:
      time.sleep(2)
      assert client.messages == [], (
        f"should not receive anything without joining the room, got: {client.messages}"
      )

      status = client.wait_for_poll_status("done", timeout=30)
      assert status.get("status") == "done"
    finally:
      client.disconnect()
