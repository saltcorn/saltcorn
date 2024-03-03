from scsession import SaltcornSession
from logs_viewer_client import LogsViewerClient
import time
import logging

LOGGER = logging.getLogger(__name__)

adminEmail='admin@foo.com'
adminPassword='AhGGr6rhu45'

staffEmail='staff@foo.com'
staffPassword='ghrarhr54hg'

class Test:
  def setup_class(self):
    SaltcornSession.reset_to_fixtures()
    SaltcornSession.cli("set-cfg", "log_level", "3")
    self.sess = SaltcornSession(port=3001)

  def teardown_class(self):
    self.sess.close()

  def test_join_logs_room(self):
    staffClient = adminClient = None
    try:
      # authorized
      adminClient = LogsViewerClient()
      adminClient.login(email=adminEmail, password=adminPassword)
      adminClient.connect()
      adminClient.join_logs_room()
      time.sleep(0.2)
      assert adminClient.callbackResult == { 'status': 'ok'} 
      # not authorized
      staffClient = LogsViewerClient()
      staffClient.login(email=staffEmail, password=staffPassword)
      staffClient.connect()
      staffClient.join_logs_room()
      time.sleep(0.2)
      assert staffClient.callbackResult == {'msg': 'Not authorized', 'status': 'error'}
    finally:
      if adminClient is not None:
        adminClient.disconnect()
      if staffClient is not None:
        staffClient.disconnect()

  def test_get_logs(self):
    adminClient = adminClientB = staffClient = None
    try:
      # join and get logs
      adminClient = LogsViewerClient()
      adminClient.login(email=adminEmail, password=adminPassword)
      adminClient.connect()
      adminClient.join_logs_room()
      time.sleep(0.2)
      assert adminClient.callbackResult == { 'status': 'ok'} 
      adminClient.load_view()
      time.sleep(0.2)
      assert len(adminClient.messages) == 1
      assert adminClient.has_log('Route /view/rooms_view user=1')
      # can't join but produce logs
      staffClient = LogsViewerClient()
      staffClient.login(email=staffEmail, password=staffPassword)
      staffClient.connect()
      staffClient.load_view()
      time.sleep(0.2)
      assert len(adminClient.messages) == 2
      assert adminClient.has_log('Route /view/rooms_view user=2')
      assert len(staffClient.messages) == 0
      # join again and only get the new logs
      adminClientB = LogsViewerClient()
      adminClientB.login(email=adminEmail, password=adminPassword)
      adminClientB.connect()
      adminClientB.join_logs_room()
      time.sleep(0.2)
      assert adminClientB.callbackResult == { 'status': 'ok'}
      assert len(adminClientB.messages) == 0
      # LOGGER.info (adminClient.messages)
    finally:
      if adminClient is not None:
        adminClient.disconnect()
      if staffClient is not None:
        staffClient.disconnect()
      if adminClientB is not None:
        adminClientB.disconnect()
