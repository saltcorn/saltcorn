from scsession import SaltcornSession
from dynamic_updates_client import DynamicUpdatesClient;
import socketio
import time

adminEmail='admin@foo.com'
adminPassword='AhGGr6rhu45'

staffEmail='staff@foo.com'
staffPassword='ghrarhr54hg'

userEmail='user@foo.com'
userPassword='GFeggwrwq45fjn'

class Test:
  def setup_class(self):
    SaltcornSession.reset_to_fixtures()
    self.sess = SaltcornSession(port=3001)

  def teardown_class(self):
    self.sess.close()

  def test_connect(self):
    client = DynamicUpdatesClient()
    client.login(email=adminEmail, password=adminPassword)
    client.connect()
    assert client.sio.connected
    client.sio.disconnect()

  def test_join_dynamic_updates_room(self):
    client = DynamicUpdatesClient()
    client.login(email=adminEmail, password=adminPassword)
    client.connect()
    client.join_dynamic_updates_room()
    time.sleep(1)

  def test_run_trigger_admin(self):
    client = DynamicUpdatesClient()
    client.login(email=adminEmail, password=adminPassword)
    client.connect()
    client.join_dynamic_updates_room()
    client.run_trigger("emit_to_admin")
    time.sleep(1)
    assert len(client.updates) == 1
    client.run_trigger("emit_to_staff")
    time.sleep(1)
    assert len(client.updates) == 1
    client.run_trigger("emit_to_admin_and_staff")
    time.sleep(1)
    assert len(client.updates) == 2
    client.run_trigger("emit_tenant_wide")
    time.sleep(1)
    assert len(client.updates) == 3

  def test_run_trigger_staff(self):
    client = DynamicUpdatesClient()
    client.login(email=staffEmail, password=staffPassword)
    client.connect()
    client.join_dynamic_updates_room()
    client.run_trigger("emit_to_admin")
    time.sleep(1)
    assert len(client.updates) == 0
    client.run_trigger("emit_to_staff")
    time.sleep(1)
    assert len(client.updates) == 1
    client.run_trigger("emit_to_admin_and_staff")
    time.sleep(1)
    assert len(client.updates) == 2
    client.run_trigger("emit_tenant_wide")
    time.sleep(1)
    assert len(client.updates) == 3

  def test_run_trigger_user(self):
    client = DynamicUpdatesClient()
    client.login(email=userEmail, password=userPassword)
    client.connect()
    client.join_dynamic_updates_room()
    client.run_trigger("emit_to_admin")
    time.sleep(1)
    assert len(client.updates) == 0
    client.run_trigger("emit_to_staff")
    time.sleep(1)
    assert len(client.updates) == 0
    client.run_trigger("emit_to_admin_and_staff")
    time.sleep(1)
    assert len(client.updates) == 0
    client.run_trigger("emit_tenant_wide")
    time.sleep(1)
    assert len(client.updates) == 1