from scsession import SaltcornSession
email = "admin@foo.com"
password="AhGGr6rhu45"

class Test:
    def setup_class(self):
        SaltcornSession.reset_to_fixtures()
        self.sess = SaltcornSession(3001)

    def teardown_class(self):
        self.sess.close()
    # helpers
    def cannot_access_admin(self):
        self.sess.get('/table')
        assert self.sess.status == 302
        assert "Your tables" not in self.sess.content

    def is_incorrect_user_or_password(self):
        assert self.sess.redirect_url == '/auth/login'
        self.sess.follow_redirect()
        assert "Incorrect user or password" in self.sess.content


    def test_public_cannot_access_admin(self):
        self.sess.reset()
        self.cannot_access_admin()

    def test_can_login_as_admin(self):
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
        self.sess.get('/table')
        assert self.sess.status == 200
        assert "Your tables" in self.sess.content

    def test_logout(self):
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
        self.sess.get('/table')
        assert self.sess.status == 200
        assert "Your tables" in self.sess.content
        self.sess.get('/auth/logout')
        assert self.sess.redirect_url == '/auth/login'
        self.cannot_access_admin()


    def test_login_without_csrf(self):
        self.sess.reset()
        self.sess.get('/auth/login')
        self.sess.postForm('/auth/login', 
            {'email': email, 
            'password': password,          
            })
        assert self.sess.redirect_url == '/auth/login'
        self.cannot_access_admin()

    def test_login_with_wrong_csrf(self):
        self.sess.reset()
        self.sess.get('/auth/login')
        self.sess.postForm('/auth/login', 
            {'email': email, 
            'password': password,   
            '_csrf': 'ytjutydetjk'       
            })
        assert self.sess.redirect_url == '/auth/login'
        self.cannot_access_admin()

    def test_login_with_blank_csrf(self):
        self.sess.reset()
        self.sess.get('/auth/login')
        self.sess.postForm('/auth/login', 
            {'email': email, 
            'password': password,   
            '_csrf': ''       
            })
        assert self.sess.redirect_url == '/auth/login'
        self.cannot_access_admin()

    def test_login_with_wrong_password(self):
        self.sess.reset()
        self.sess.get('/auth/login')
        self.sess.postForm('/auth/login', 
            {'email': email, 
            'password': 'fidelio', 
            '_csrf': self.sess.csrf()     
            })
        self.is_incorrect_user_or_password()
        self.cannot_access_admin()

    def test_login_with_no_password(self):
        self.sess.reset()
        self.sess.get('/auth/login')
        self.sess.postForm('/auth/login', {'email': email , '_csrf': self.sess.csrf()})
        self.is_incorrect_user_or_password()
        self.cannot_access_admin()

    def test_login_with_no_email(self):
        self.sess.reset()
        self.sess.get('/auth/login')
        self.sess.postForm('/auth/login', {'password': password, '_csrf': self.sess.csrf()})
        self.is_incorrect_user_or_password()
        self.cannot_access_admin()

    def test_login_with_blank_email(self):
        self.sess.reset()
        self.sess.get('/auth/login')
        self.sess.postForm('/auth/login', {'email':'', 'password': password, '_csrf': self.sess.csrf()})
        self.is_incorrect_user_or_password()
        self.cannot_access_admin()

    def test_login_with_nothing(self):
        self.sess.reset()
        self.sess.get('/auth/login')
        self.sess.postForm('/auth/login', {'_csrf': self.sess.csrf()})
        self.is_incorrect_user_or_password()
        self.cannot_access_admin()

    def test_login_with_blank_password(self):
        self.sess.reset()
        self.sess.get('/auth/login')
        self.sess.postForm('/auth/login', {'email': email,'password': '', '_csrf': self.sess.csrf()})
        self.is_incorrect_user_or_password()
        self.cannot_access_admin()