from sectest import Session
import re

class SaltcornSession(Session):
  def __init__(self, port=3000):
    Session.__init__(self, 'http://localhost:%d/' % port)
    #Session.__init__(self, 'https://saltcorn.com/')

  def csrf(self):
    m = re.findall('_sc_globalCsrf = "([^"]*)"', self.content)
    return m[0]