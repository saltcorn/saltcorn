from sectest import Session
import re
import subprocess
import time

class SaltcornSession(Session):
  def __init__(self, port=3000):
    self.salcorn_process = subprocess.Popen(["saltcorn", "serve", "-p", str(port)])
    Session.__init__(self, 'http://localhost:%d/' % port)
    self.wait_for_port_open()

  def __del__(self):
    self.salcorn_process.kill()

  def csrf(self):
    m = re.findall('_sc_globalCsrf = "([^"]*)"', self.content)
    return m[0]