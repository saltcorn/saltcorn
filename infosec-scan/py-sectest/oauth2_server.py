import subprocess
from helpers import wait_for_port_open

class OAuth2Server:
  def __init__(self, port=3030):
    subprocess.call(
      args=["npm", "install"],
      cwd="infosec-scan/oauth2-test-server")
    self.auth_server_process = subprocess.Popen(
        args=["node", "app.js"], 
        cwd="infosec-scan/oauth2-test-server")
    self.base_url = 'http://localhost:%d/' % port
    wait_for_port_open(self.base_url)

  def __del__(self):
    self.close()

  def close(self):
    self.auth_server_process.kill()
