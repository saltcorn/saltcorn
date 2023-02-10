from scsession import SaltcornSession
import socketio

class ChatClient:
  def __init__(self):
    self.session = SaltcornSession(port=3001, open_process=False)
    self.messages = []
    sio = socketio.Client()
    @sio.event
    def message(data):
      self.messages.append(data)
    self.sio = sio
    self.init_csrf()

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

  def join_room(self, viewName, roomId):
    self.sio.emit("join_room",  [viewName, roomId])

  def send_message(self, room_id, content, view_name):
    self.session.get('/view/rooms_view?id=%d' % room_id)
    self.session.postForm('/view/' + view_name + '/submit_msg_ajax', 
      {'room_id': room_id,
      'content': content,
      '_csrf': self.session.csrf()
      })

  def has_message(self, content, not_for_user_id):
    return any(
        x for x in self.messages if content in x['append'] 
            and not_for_user_id == x['not_for_user_id']
      )

  def disconnect(self):
    self.sio.disconnect()
