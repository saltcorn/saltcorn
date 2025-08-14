from scsession import SaltcornSession
from real_time_collab_client import RealTimeCollabClient;
import socketio
import time
import logging

logging.basicConfig(
  level=logging.INFO,
  format='[%(asctime)s] %(levelname)s - %(message)s',
  datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

adminEmail='admin@foo.com'
adminPassword='AhGGr6rhu45'

class Test:
  def setup_class(self):
    SaltcornSession.reset_to_fixtures()
    self.sess = SaltcornSession(port=3001)

  def teardown_class(self):
    self.sess.close()

  """
    simple test to check if the client can connect to the server
  """
  def test_connect(self):
    client = RealTimeCollabClient()
    client.login(email=adminEmail, password=adminPassword)
    client.connect()
    assert client.sio.connected
    client.sio.disconnect()

  def test_join_collab_room(self):
    client = RealTimeCollabClient()
    client.login(email=adminEmail, password=adminPassword)
    client.connect()
    viewName = 'authoredit'
    client.join_collab_room(viewName)
    time.sleep(1)

  def test_send_update(self):
    client = RealTimeCollabClient()
    client.login(email=adminEmail, password=adminPassword)
    client.connect()
    viewName = 'authoredit'
    client.join_collab_room(viewName)
    client.register_event_handler('authoredit_UPDATE_EVENT?id=1')
    client.send_update('books', 1, {'author': 'New Author', 'pages': 213})
    time.sleep(1)
    assert len(client.updates) > 0

  def test_send_update_with_custom_event(self):
    client = RealTimeCollabClient()
    client.login(email=adminEmail, password=adminPassword)
    client.connect()
    viewName = 'authoredit'
    client.join_collab_room(viewName)
    client.register_event_handler('authoredit_UPDATE_EVENT?id=1')
    client.send_update('books', 1, {'author': 'My Author', 'pages': 213})
    time.sleep(1)
    assert len(client.updates) > 0
    expected = {
      'updates': {'author': 'My Author'},
      'actions': [{
        'eval_js': 'console.log("Custom update event triggered");',
        'row': {
          'new_row': {
            'author': 'My Author',
            'id': '1',
            'pages': 213,
            'publisher': None
          },
          'old_row': {
            'author': 'New Author',
            'id': 1,
            'pages': 213,
            'publisher': None
          },
          'updates': {'author': 'My Author'}
        }
      }]
    }
    assert client.updates[0] == expected

  def test_send_update_without_layout_field(self):
    client = RealTimeCollabClient()
    client.login(email=adminEmail, password=adminPassword)
    client.connect()
    viewName = 'authoredit'
    client.join_collab_room(viewName)
    client.register_event_handler('authoredit_UPDATE_EVENT?id=1')
    client.send_update('books', 1, {'pages': 23})
    time.sleep(1)
    assert len(client.updates) == 0

  def test_send_update_without_changes(self):
    client = RealTimeCollabClient()
    client.login(email=adminEmail, password=adminPassword)
    client.connect()
    viewName = 'authoredit'
    client.join_collab_room(viewName)
    client.register_event_handler('authoredit_UPDATE_EVENT?id=1')
    client.send_update('books', 1, {'author': 'MisterJ', 'pages': 213})
    time.sleep(1)
    assert len(client.updates) > 0
    client.send_update('books', 1, {'author': 'MisterJ', 'pages': 213})
    time.sleep(1)
    assert len(client.updates) == 1