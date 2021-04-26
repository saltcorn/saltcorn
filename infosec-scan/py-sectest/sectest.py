import requests
from urllib.parse import urljoin

class Session:
  def __init__(self, base_url):
    self.base_url = base_url
    self.status = None
    self.response = None
    self.session = requests.Session()

  def __read_response(self, resp):
    self.status = resp.status_code

  def get(self, url):
    resp = self.session.get(urljoin(self.base_url, url))
    self.__read_response(resp)
   

  