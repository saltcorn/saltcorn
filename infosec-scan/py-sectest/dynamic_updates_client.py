from scsession import SaltcornSession
import socketio
import logging
logging.basicConfig(
  level=logging.INFO,
  format='[%(asctime)s] %(levelname)s - %(message)s',
  datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)

class DynamicUpdatesClient:
  def __init__(self):
    self.session = SaltcornSession(port=3001, open_process=False)
    self.updates = []
    sio = socketio.Client()
    sio.on('dynamic_update', self.handle_update_event)
    self.sio = sio
    self.init_csrf()

  def handle_update_event(self, data):
    logger.info("handle_event")
    self.updates.append(data)

  def init_csrf(self):
    self.session.get('/auth/login')
    self.csrf = self.session.csrf()

  def login(self, email, password):
    self.session.postForm('/auth/login', 
      {'email': email, 
        'password': password, 
        '_csrf': self.csrf
      })
    assert self.session.redirect_url == '/'

  def connect(self):
    auth_headers = 'connect.sid=' + self.session.sessionID() + '; loggedin=true'
    self.sio.connect('http://localhost:3001', 
      transports= ["websocket"], headers={'cookie': auth_headers})

  def join_dynamic_updates_room(self):
    self.sio.emit("join_dynamic_update_room")

  def run_trigger(self, name):
    self.session.apiPost(f'/api/action/{name}', {})
