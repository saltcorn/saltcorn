from scsession import SaltcornSession

class Test:
    def setup_class(self):
        SaltcornSession.reset_to_fixtures()
        self.sess = SaltcornSession(3002)

    def teardown_class(self):
        self.sess.close()
    # helpers
    def cannot_access_admin(self):
        self.sess.get('/table')
        assert self.sess.status == 302
        assert "Your tables" not in self.sess.content

    def test_public_home_is_redirect(self):
        self.sess.reset()
        self.sess.get('/')
        assert self.sess.redirect_url == '/auth/login'
        self.cannot_access_admin()

    def test_can_signup(self):
        self.sess.reset()
        self.sess.get('/auth/signup')
        assert "Sign up" in self.sess.content
        assert self.sess.status == 200
        self.sess.postForm('/auth/signup', 
            {'email': 'thebestuser@mail.com', 
            'password': 'ty435y5OPtyj', 
            '_csrf': self.sess.csrf()
            })
        assert self.sess.redirect_url == '/'
        self.sess.follow_redirect()
        assert 'Welcome to Saltcorn!' in self.sess.content
        self.cannot_access_admin()
        self.sess.get('/auth/logout')
        assert self.sess.redirect_url == '/auth/login'
        self.sess.follow_redirect()
        self.sess.postForm('/auth/login', 
            {'email': 'thebestuser@mail.com', 
            'password': 'ty435y5OPtyj', 
            '_csrf': self.sess.csrf()
            })
        assert self.sess.redirect_url == '/'

    def test_cannot_signup_again(self):
        self.sess.reset()
        self.sess.get('/auth/signup') 
        self.sess.postForm('/auth/signup', 
            {'email': 'thebestuser@mail.com', 
            'password': 'ty435y5OPtyj', 
            '_csrf': self.sess.csrf()
            })
        assert self.sess.redirect_url == '/auth/signup'
    
    def test_needs_password(self):
        self.sess.reset()
        self.sess.get('/auth/signup') 
        self.sess.postForm('/auth/signup', 
            {'email': 'thebestuser15@mail.com',             
            '_csrf': self.sess.csrf()
            })
        assert self.sess.redirect_url == '/auth/signup'
    def test_needs_long_password(self):
        self.sess.reset()
        self.sess.get('/auth/signup') 
        self.sess.postForm('/auth/signup', 
            {'email': 'thebestuser16@mail.com',  
            'password': 'pass', 
            '_csrf': self.sess.csrf()
            })
        assert "Too short" in self.sess.content
        assert self.sess.redirect_url == None

    def test_needs_strong_password(self):
        self.sess.reset()
        self.sess.get('/auth/signup') 
        self.sess.postForm('/auth/signup', 
            {'email': 'thebestuser16@mail.com',  
            'password': 'password1', 
            '_csrf': self.sess.csrf()
            })
        assert "Too common" in self.sess.content
        assert self.sess.redirect_url == None


    def test_signup_no_csrf(self):
        self.sess.reset()
        self.sess.get('/auth/signup')
        self.sess.postForm('/auth/signup', 
            {'email': 'thebestus2er@mail.com', 
            'password': 'ty435yqpiOPtyj', 
            })
        assert self.sess.redirect_url == '/'
        self.sess.follow_redirect()
        assert self.sess.redirect_url == '/auth/login'
        self.sess.follow_redirect()
        self.sess.postForm('/auth/login', 
            {'email': 'thebestus2er@mail.com', 
            'password': 'ty435yqpiOPtyj', 
            '_csrf': self.sess.csrf()
            })
        assert self.sess.redirect_url == '/auth/login'
        self.sess.follow_redirect()
        assert "Incorrect user or password" in self.sess.content

    def test_cannot_inject_role_id(self):
        self.sess.reset()
        self.sess.get('/auth/signup')
        assert "Sign up" in self.sess.content
        assert self.sess.status == 200
        self.sess.postForm('/auth/signup', 
            {'email': 'theworstuser@mail.com', 
            'password': 'ty11y5OPtyj', 
            'role_id': '1',
            '_csrf': self.sess.csrf()
            })
        assert self.sess.redirect_url == '/'
        self.sess.follow_redirect()
        self.cannot_access_admin()
