import pytest
from scsession import SaltcornSession
from oauth2_server import OAuth2Server

class Test:
  def setup_class(self):
    SaltcornSession.reset_to_fixtures()
    SaltcornSession.cli("install-plugin", "-n", "oauth2-auth")
    SaltcornSession.cli("set-cfg", "-p", "oauth2-auth", "clientID", "_saltcorn_client_id_")
    SaltcornSession.cli("set-cfg", "-p", "oauth2-auth", "clientSecret", "2e85aa0c063aa97329a31fbb")
    SaltcornSession.cli("set-cfg", "-p", "oauth2-auth", "label", "my test oauth2 server")
    SaltcornSession.cli("set-cfg", "-p", "oauth2-auth", "authorizationURL", "http://localhost:3030/oauth2/authorize")
    SaltcornSession.cli("set-cfg", "-p", "oauth2-auth", "tokenURL", "http://localhost:3030/oauth2/token")
    SaltcornSession.cli("set-cfg", "-p", "oauth2-auth", "scope", "user.read")
    self.sess = SaltcornSession(3001)
    self.oauth2_server = OAuth2Server()

  def teardown_class(self):
    self.sess.close()
    self.oauth2_server.close()

  def test_login_with_set_email(self):
    self.sess.get('/auth/login')
    csrf = self.sess.csrf()
    # no 'userInfoURL' configured the user has to enter its email
    self.sess.get('/auth/login-with/oauth2', allow_redirects=True)
    assert 'Set Email' in self.sess.content
  
    self.sess.postForm('/auth/set-email', 
        data={'email': 'my_mail@auth.com', '_csrf': self.sess.csrf()}, allow_redirects=True)
    assert 'Welcome, my_mail@auth.com!' in self.sess.content

  def test_login_with_userinfo_from_auth_server(self):
    # configure 'userInfoURL' to get the email
    self.sess.close()
    SaltcornSession.cli("set-cfg", "-p", "oauth2-auth", "userInfoURL", "http://localhost:3030/user")
    self.sess.open()
    # skip auth server login and accept
    # the auth server uses a dummy user and accepts automaticly
    self.sess.get('/auth/login-with/oauth2', allow_redirects=True)
    assert 'Welcome, foo@bar.com!' in self.sess.content

  def test_login_invalid_secret(self):
    self.sess.close()
    SaltcornSession.cli("set-cfg", "-p", "oauth2-auth", "clientSecret", "invalid_secret")
    self.sess.open()    
    with pytest.raises(Exception) as e_info:
      self.sess.get('/auth/login-with/oauth2', allow_redirects=True, timeout=3)
