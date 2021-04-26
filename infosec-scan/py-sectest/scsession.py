from sectest import Session

class SaltcornSession(Session):
  def __init__(self, port=3000):
    Session.__init__(self, 'http://localhost:%d/' % port)