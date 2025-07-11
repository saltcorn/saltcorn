from scsession import SaltcornSession
import socketio
import logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)

class RealTimeCollabClient:
  def __init__(self):
    self.session = SaltcornSession(port=3001, open_process=False)
    self.updates = []
    sio = socketio.Client()
    
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

  def join_collab_room(self, viewName):
    self.sio.emit("join_collab_room", viewName)

  def send_update(self, tablename, id, data):
    self.session.apiPost(f'/api/{tablename}/{id}', data)

  def register_event_handler(self, event_name):
    self.sio.on(event_name, self.handle_update_event)
