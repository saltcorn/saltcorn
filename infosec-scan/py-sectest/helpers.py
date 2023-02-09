import time
from urllib.request import urlopen

def wait_for_port_open(url):
  i=0
  while i<30:
    try:
      response = urlopen(url,timeout=1)
      return
    except:
      print("Closed, retry")
      time.sleep(0.25)
      i=i+1
      pass
  raise ValueError("wait_for_port_open: Iterations exceeded")
