from sectest import Session
import re
import subprocess
import os 
from helpers import wait_for_port_open

class SaltcornSession(Session):
  def __init__(self, port=3001, open_process=True):
    self.salcorn_process = None
    self.open(port, open_process)

  def __del__(self):
    self.close()

  def csrf(self):
    m = re.findall('_sc_globalCsrf = "([^"]*)"', self.content)
    if len(m) > 0:
      return m[0]
    else:
      return ""

  def close(self):
    if self.salcorn_process is not None:
      self.salcorn_process.kill()

  def open(self, port=3001, open_process=True):
    if open_process is True:
      self.salcorn_process = subprocess.Popen(["packages/saltcorn-cli/bin/saltcorn", "serve", "-p", str(port)])
    Session.__init__(self, 'http://localhost:%d/' % port)
    wait_for_port_open(self.base_url)    

  @staticmethod
  def reset_to_fixtures():
    SaltcornSession.cli("reset-schema", "-f")
    SaltcornSession.cli("fixtures")

  @staticmethod
  def cli(*args):
    subprocess.run(["packages/saltcorn-cli/bin/saltcorn"]+list(args), check=True)

  @staticmethod
  def asset_path(name):
    return os.path.join(os.path.dirname(os.path.realpath(__file__)), "assets", name)