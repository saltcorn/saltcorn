from scsession import SaltcornSession
import pyotp
import re
email = "admin@foo.com"
password = "AhGGr6rhu45"


class Test:
    def setup_class(self):
        SaltcornSession.reset_to_fixtures()
        self.sess = SaltcornSession(3001)
        self.totp_key = None

    def teardown_class(self):
        self.sess.close()
    # helpers

    def test_enable_twofa(self):
        self.sess.reset()
        self.sess.get('/auth/login')
        assert "Login" in self.sess.content
        assert self.sess.status == 200
        self.sess.postForm('/auth/login',
                           {'email': email,
                            'password': password,
                            '_csrf': self.sess.csrf()
                            })
        assert self.sess.redirect_url == '/'
        self.sess.get('/auth/settings')
        assert self.sess.status == 200
        assert "Two-factor authentication is disabled" in self.sess.content
        self.sess.get('/auth/twofa/setup/totp')
        totp_key = re.findall(r'<pre>(.+?)</pre>', self.sess.content)[0]
        totp_code = pyotp.TOTP(totp_key).now()
        self.sess.postForm('/auth/twofa/setup/totp',
                           {'totpCode': totp_code,
                            '_csrf': self.sess.csrf()
                            })
        assert self.sess.redirect_url == '/auth/settings'
        self.sess.get('/auth/settings')
        assert self.sess.status == 200
        assert "Two-factor authentication with Time-based One-Time Password enabled" in self.sess.content
        assert "Two-factor authentication is enabled" in self.sess.content

        self.sess.get('/auth/logout')
        self.sess.get('/auth/login')
        assert "Login" in self.sess.content
        assert self.sess.status == 200
        self.sess.postForm('/auth/login',
                           {'email': email,
                            'password': password,
                            '_csrf': self.sess.csrf()
                            })
        assert self.sess.redirect_url == '/auth/twofa/login/totp'
        self.sess.get('/auth/twofa/login/totp')
        totp_code = pyotp.TOTP(totp_key).now()
        self.sess.postForm('/auth/twofa/login/totp',
                           {'code': totp_code,
                            '_csrf': self.sess.csrf()
                            })
        assert self.sess.redirect_url == '/'
        self.sess.get('/table')
        assert self.sess.status == 200
        assert "Your tables" in self.sess.content
        self.sess.get('/view/patientlist')
        assert self.sess.status == 200
        assert "Michael Douglas" in self.sess.content

    # def test_reject_wrong_twofa_code(self):
        self.sess.reset()
        self.sess.get('/auth/login')
        assert "Login" in self.sess.content
        assert self.sess.status == 200
        self.sess.postForm('/auth/login',
                           {'email': email,
                            'password': password,
                            '_csrf': self.sess.csrf()
                            })
        assert self.sess.redirect_url == '/auth/twofa/login/totp'
        self.sess.get('/auth/twofa/login/totp')

        self.sess.postForm('/auth/twofa/login/totp',
                           {'code': '123456',
                            '_csrf': self.sess.csrf()
                            })
        assert self.sess.redirect_url == '/auth/twofa/login/totp'

    # def test_no_twofa_pypass(self):
        self.sess.reset()
        self.sess.get('/auth/login')
        assert "Login" in self.sess.content
        assert self.sess.status == 200
        self.sess.postForm('/auth/login',
                           {'email': email,
                            'password': password,
                            '_csrf': self.sess.csrf()
                            })
        assert self.sess.redirect_url == '/auth/twofa/login/totp'
        self.sess.get('/table')
        assert self.sess.status == 302
        assert self.sess.redirect_url == '/auth/twofa/login/totp'
        self.sess.get('/view/patientlist')
        assert self.sess.status == 302
        assert self.sess.redirect_url == '/'
