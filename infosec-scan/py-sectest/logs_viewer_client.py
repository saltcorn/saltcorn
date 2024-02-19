from scsession import SaltcornSession
import socketio

class LogsViewerClient:
  # perhaps a common class for this and the chat client
  def __init__(self):
    self.session = SaltcornSession(port=3001, open_process=False)
    self.messages = []
    self.callbackResult = None
    sio = socketio.Client()
    @sio.event
    def log_msg(data):
      self.messages.append(data)
    self.sio = sio
    self.init_csrf()

  def init_csrf(self):
    self.session.get('/auth/login')
    self.csrf = self.session.csrf()

  def has_log(self, text):
    return any(x['text'] == text for x in self.messages)

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

  def join_logs_room(self):
    def cb(ack):
      self.callbackResult = ack
    self.sio.emit("join_log_room", callback=cb)

  def disconnect(self):
    self.sio.disconnect()

  def load_view(self):
    self.session.get('/view/rooms_view?id=1')
