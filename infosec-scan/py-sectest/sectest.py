import requests
from urllib.parse import urljoin

class Session:
  def __init__(self, base_url):
    self.base_url = base_url
    self.reset()

  def __read_response(self, resp):
    self.status = resp.status_code
    self.content = resp.text
    #print(resp.content)

  def get(self, url):
    resp = self.session.get(urljoin(self.base_url, url))
    self.__read_response(resp)
   
  def reset(self):
    self.status = None
    self.content = None
    self.session = requests.Session()
  