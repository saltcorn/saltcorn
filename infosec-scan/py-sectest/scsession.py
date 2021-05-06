from sectest import Session
import re
import subprocess
import os 

class SaltcornSession(Session):
  def __init__(self, port=3001):
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
    SaltcornSession.cli("fixtures", "-r")

  @staticmethod
  def cli(*args):
    subprocess.run(["packages/saltcorn-cli/bin/saltcorn"]+list(args), check=True)

  @staticmethod
  def asset_path(name):
    return os.path.join(os.path.dirname(os.path.realpath(__file__)), "assets", name)