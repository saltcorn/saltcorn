from sectest import Session
import re
import subprocess
import os 
from helpers import wait_for_port_open
import threading
import logging

logging.basicConfig(
  level=logging.INFO,
  format='[%(asctime)s] %(levelname)s - %(message)s',
  datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)

class SaltcornSession(Session):
  def __init__(self, port=3001, open_process=True, env_vars=None, pipe_output=False):
    self.salcorn_process = None
    self.open(port, open_process, env_vars, pipe_output)

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

  def open(self, port=3001, open_process=True, env_vars=None, pipe_output=False):
    if open_process is True:
      env = os.environ.copy()

      if env_vars:
        for key, value in env_vars.items():
            env[key] = str(value)

      stdout_setting = subprocess.PIPE if pipe_output else None
      stderr_setting = subprocess.STDOUT if pipe_output else None

      self.salcorn_process = subprocess.Popen(
          ["packages/saltcorn-cli/bin/saltcorn", "serve", "-p", str(port)],
          env=env,
          stdout=stdout_setting,
          stderr=stderr_setting,
          text=True,
          bufsize=1
      )

      if pipe_output:
        def stream_output(pipe):
          for line in iter(pipe.readline, ""):
            logger.info("[saltcorn] %s", line.rstrip())

        # background thread so pytest does not block
        threading.Thread(
            target=stream_output,
            args=(self.salcorn_process.stdout,),
            daemon=True
        ).start()
    Session.__init__(self, 'http://localhost:%d/' % port)
    wait_for_port_open(self.base_url)    

  @staticmethod
  def reset_to_fixtures():
    SaltcornSession.cli("reset-schema", "-f")
    SaltcornSession.cli("fixtures")

  @staticmethod
  def cli(*args):
    result = subprocess.run(["packages/saltcorn-cli/bin/saltcorn"]+list(args),                              
                             capture_output = True,
                             check= True,
                             text = True)
                             
  @staticmethod
  def asset_path(name):
    return os.path.join(os.path.dirname(os.path.realpath(__file__)), "assets", name)