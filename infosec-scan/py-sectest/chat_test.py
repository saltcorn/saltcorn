from scsession import SaltcornSession
from chat_client import ChatClient;

# import logging
# LOGGER = logging.getLogger(__name__)

import socketio
import time

staffEmail='staff@foo.com'
staffPassword='ghrarhr54hg'

adminEmail='admin@foo.com'
adminPassword='AhGGr6rhu45'

fooEmail='user@foo.com'
fooPassword='GFeggwrwq45fjn'

publicRoomsView='rooms_view'
adminRoomsView='admin_rooms_view'

class Test:
  def setup_class(self):
    SaltcornSession.reset_to_fixtures()
    self.sess = SaltcornSession(port=3001)

  def teardown_class(self):
    self.sess.close()

  """
    'staff' sends, 'admin' sends
    assert: both clients have two messages
            check 'not_for_user_id'
    'foo' joins and sends one message
    assert: len(messages) of 'staff' and 'admin' equals 3
            'foo' has only one message
  """
  def test_exchange_messages(self):
    adminClient = staffClient = fooClient = None
    try:
      # 'staff -> admin', 'admin -> staff'
      adminClient = ChatClient()
      adminClient.login(email=adminEmail, password=adminPassword)
      adminClient.connect()
      adminClient.join_room(viewName=publicRoomsView, roomId=1)
      staffClient = ChatClient()
      staffClient.login(email=staffEmail, password=staffPassword)
      staffClient.connect()
      staffClient.join_room(viewName=publicRoomsView, roomId=1)
      staffMsg = 'message from staff'
      staffClient.send_message(
        room_id=1, content=staffMsg,
        view_name=publicRoomsView
      )
      time.sleep(0.2)
      assert len(adminClient.messages) == 1
      assert adminClient.has_message(
          content=staffMsg,
          not_for_user_id=2
      )
      assert len(staffClient.messages) == 1
      assert staffClient.has_message(
          content=staffMsg,
          not_for_user_id=2
      )
      adminMsg = 'message from admin'
      adminClient.send_message(
        room_id=1, content=adminMsg,
        view_name=publicRoomsView
      )
      time.sleep(0.2)
      assert len(staffClient.messages) == 2
      assert staffClient.has_message(
          content=adminMsg,
          not_for_user_id=1
      )
      assert len(adminClient.messages) == 2
      assert adminClient.has_message(
          content=adminMsg,
          not_for_user_id=1
      )
      # foo joins
      fooClient = ChatClient()
      fooClient.login(email=fooEmail, password=fooPassword)
      fooClient.connect()
      fooClient.join_room(viewName=publicRoomsView, roomId=1)
      fooMsg = 'message from foo'
      fooClient.send_message(
        room_id=1, content=fooMsg, 
        view_name=publicRoomsView
      )
      time.sleep(0.2)
      assert len(fooClient.messages) == 1
      assert fooClient.has_message(
        content=fooMsg,
        not_for_user_id=3
      )
      assert len(adminClient.messages) == 3
      assert adminClient.has_message(
        content=fooMsg,
        not_for_user_id=3
      )
      assert len(staffClient.messages) == 3
      assert staffClient.has_message(
        content=fooMsg,
        not_for_user_id=3
      )
    finally:
      if adminClient is not None:
        adminClient.disconnect()
      if staffClient is not None:
        staffClient.disconnect()
      if fooClient is not None:
        fooClient.disconnect()

  """
    'staff' sends into Room B
    assert: no one receives it
    'staff' sends into RoomA
    assert: 'admin' and 'foo' have one message 
  """
  def test_not_participating(self):
    adminClient = staffClient = None
    try:
      adminClient = ChatClient()
      adminClient.login(email=adminEmail, password=adminPassword)
      adminClient.connect()
      adminClient.join_room(viewName=publicRoomsView, roomId=1)
      adminClient.join_room(viewName=publicRoomsView, roomId=2)
      staffClient = ChatClient()
      staffClient.login(email=staffEmail, password=staffPassword)
      staffClient.connect()
      staffClient.join_room(viewName=publicRoomsView, roomId=1)
      staffClient.join_room(viewName=publicRoomsView, roomId=2)
      staffClient.send_message(
        room_id=2, content='lost message from staff',
        view_name=publicRoomsView
      )
      time.sleep(0.2)
      assert len(adminClient.messages) == 0
      assert len(staffClient.messages) == 0
      staffMsg = 'valid messge from staff'
      staffClient.send_message(
        room_id=1, content=staffMsg,
        view_name=publicRoomsView
      )
      time.sleep(0.2)
      assert len(adminClient.messages) == 1
      assert len(staffClient.messages) == 1
      assert staffClient.has_message(
          content=staffMsg,
          not_for_user_id=2
      )
      assert adminClient.has_message(
          content=staffMsg,
          not_for_user_id=2
      )
    finally:
      if adminClient is not None:
        adminClient.disconnect()
      if staffClient is not None:
        staffClient.disconnect()


  """
    a client without login joins and sends a message
    assert: 'staff' has no messages
  """
  def test_join_without_login(self):
    withoutLogin = staffClient = None
    try:
      withoutLogin = ChatClient()
      withoutLogin.connect()
      withoutLogin.join_room(viewName=publicRoomsView, roomId=1)
      staffClient = ChatClient()
      staffClient.login(email=staffEmail, password=staffPassword)
      staffClient.connect()
      staffClient.join_room(viewName=publicRoomsView, roomId=1)
      withoutLogin.send_message(
        room_id=1, content='message content',
        view_name=publicRoomsView
      )
      time.sleep(0.2)
      assert len(withoutLogin.messages) == 0
      assert len(staffClient.messages) == 0
    finally:
      if withoutLogin is not None:
        withoutLogin.disconnect()
      if staffClient is not None:
        staffClient.disconnect()

  """
    'staff' sends into 'admin_rooms_view' (min_role=1)
    assert: 'staff' and 'admin' have no messages
    'admin' sends into 'admin_rooms_view'
    assert: only 'admin' has one message 
            and check 'not_for_user_id'
  """
  def test_rooms_insufficient_role(self):
    adminClient = staffClient = None
    try:
      adminClient = ChatClient()
      adminClient.login(email=adminEmail, password=adminPassword)
      adminClient.connect()
      adminClient.join_room(viewName=adminRoomsView, roomId=1)
      staffClient = ChatClient()
      staffClient.login(email=staffEmail, password=staffPassword)
      staffClient.connect()
      staffClient.join_room(viewName=adminRoomsView, roomId=1)
      staffClient.send_message(
        room_id=1, content='lost message from staff', 
        view_name=adminRoomsView
      )
      time.sleep(0.2)
      assert len(adminClient.messages) == 0
      assert len(staffClient.messages) == 0
      adminMsg = 'message from admin'
      adminClient.send_message(
        room_id=1, content=adminMsg,
        view_name=adminRoomsView
      )
      time.sleep(0.2)
      assert len(adminClient.messages) == 1
      assert len(staffClient.messages) == 0
      assert adminClient.has_message(
          content=adminMsg,
          not_for_user_id=1
      )
    finally:
      if adminClient is not None:
        adminClient.disconnect()
      if staffClient is not None:
        staffClient.disconnect()
