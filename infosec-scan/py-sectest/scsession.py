from sectest import Session
import re
import subprocess

class SaltcornSession(Session):
  def __init__(self, port=3000):
    self.salcorn_process = subprocess.Popen(["packages/saltcorn-cli/bin/saltcorn", "serve", "-p", str(port)])
    Session.__init__(self, 'http://localhost:%d/' % port)
    self.wait_for_port_open()

  def __del__(self):
    self.salcorn_process.kill()

  def csrf(self):
    m = re.findall('_sc_globalCsrf = "([^"]*)"', self.content)
    return m[0]

  @staticmethod
  def reset_to_fixtures():
    subprocess.run(["packages/saltcorn-cli/bin/saltcorn", "fixtures", "-r"], check=True)