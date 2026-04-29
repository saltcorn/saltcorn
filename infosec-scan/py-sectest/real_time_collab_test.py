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

  # ── Security tests for GHSA-vrm5-86xf-hh6h ─────────────────────────────────
  # Before the fix, join_collab_room put every socket into one tenant-wide room
  # (_${tenant}_collab_room_).  The emitter broadcast all Edit-view UPDATE events
  # to that room, so joining with *any* view granted visibility of every other
  # view's real-time updates.
  # The fix scopes the room per view: _${tenant}_collab_room_${viewname}_
  # ────────────────────────────────────────────────────────────────────────────

  def test_unauthorized_user_cannot_join_admin_view_room(self):
    """
    join_collab_room must reject a socket whose role exceeds the view's min_role.
    admin_authoredit has min_role=1 (admin only); a public socket must get an error.
    """
    client = RealTimeCollabClient()
    # do NOT log in — role_id 100 (public)
    client.connect()
    ack = client.join_collab_room_with_ack('admin_authoredit')
    assert ack.get('status') == 'error', (
      f"Expected error joining admin-only room, got: {ack}"
    )
    client.sio.disconnect()

  def test_idor_low_priv_user_does_not_receive_admin_view_events(self):
    """
    GHSA-vrm5-86xf-hh6h: a user joined to 'authoredit' room must NOT receive
    real-time UPDATE events emitted by the admin-only 'admin_authoredit' view.
    Before the fix both views shared _${tenant}_collab_room_ so any joined
    socket received updates from every Edit view in the tenant.
    """
    attacker = RealTimeCollabClient()
    attacker.login(email='user@foo.com', password='GFeggwrwq45fjn')
    attacker.connect()
    ack = attacker.join_collab_room_with_ack('authoredit')
    assert ack.get('status') == 'ok'
    attacker.register_event_handler('admin_authoredit_UPDATE_EVENT?id=1')

    admin = RealTimeCollabClient()
    admin.login(email=adminEmail, password=adminPassword)
    admin.submit_view_form('admin_authoredit', 1, {'author': 'secret admin value'})
    time.sleep(1)

    assert len(attacker.updates) == 0, (
      "IDOR: regular user received UPDATE events from an admin-only view "
      "via the shared collab room"
    )
    attacker.sio.disconnect()

  def test_per_view_room_isolation(self):
    """
    Each view's collab room is isolated: events emitted for view A must NOT
    arrive on a socket that joined only view B's room, and vice versa.

    Both authoredit and admin_authoredit share the books table and each
    register a virtual Update trigger, so updating any book fires both
    triggers.  The security property is that each trigger emits only to its
    own per-view room.  Each client registers only the cross-room event (the
    event it must never receive) so the assertion can cleanly stay at zero.
    """
    # client_a: joined authoredit room — must NOT receive admin_authoredit events
    client_a = RealTimeCollabClient()
    client_a.login(email='user@foo.com', password='GFeggwrwq45fjn')
    client_a.connect()
    assert client_a.join_collab_room_with_ack('authoredit').get('status') == 'ok'
    client_a.register_event_handler('admin_authoredit_UPDATE_EVENT?id=1')

    # client_b: joined admin_authoredit room — must NOT receive authoredit events
    client_b = RealTimeCollabClient()
    client_b.login(email=adminEmail, password=adminPassword)
    client_b.connect()
    assert client_b.join_collab_room_with_ack('admin_authoredit').get('status') == 'ok'
    client_b.register_event_handler('authoredit_UPDATE_EVENT?id=1')

    admin_trigger = RealTimeCollabClient()
    admin_trigger.login(email=adminEmail, password=adminPassword)

    # Updating a book fires both views' virtual triggers, each emitting to its
    # own scoped room.  Neither client should receive the other view's event.
    admin_trigger.submit_view_form('authoredit', 1, {'author': 'room isolation test'})
    time.sleep(1)

    assert len(client_a.updates) == 0, (
      "IDOR: user in authoredit room received admin_authoredit UPDATE events "
      "(cross-room leakage)"
    )
    assert len(client_b.updates) == 0, (
      "IDOR: admin in admin_authoredit room received authoredit UPDATE events "
      "(cross-room leakage)"
    )

    client_a.sio.disconnect()
    client_b.sio.disconnect()
