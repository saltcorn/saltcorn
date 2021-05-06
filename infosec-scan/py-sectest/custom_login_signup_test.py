from scsession import SaltcornSession



class Test:
    def setup_class(self):
        SaltcornSession.cli("reset-schema", "-f")
        SaltcornSession.cli("install-pack", "-f", SaltcornSession.asset_path("custom_login_signup_pack.json"))
        SaltcornSession.cli("set-cfg", "new_user_form","userinfo" )
        SaltcornSession.cli("set-cfg", "login_form","login" )
        SaltcornSession.cli("set-cfg", "signup_form","signup" )
        SaltcornSession.cli("set-cfg", "user_settings_form","userinfo" )

        self.sess = SaltcornSession(3001)
    def teardown_class(self):
        self.sess.close()
    def cannot_access_admin(self):
        self.sess.get('/table')
        assert self.sess.status == 302
        assert "Your tables" not in self.sess.content

    def test_can_signup_custom(self):
        self.sess.reset()
        self.sess.get('/auth/signup')
        assert "Sign up" in self.sess.content
        assert ">username<" in self.sess.content
        assert self.sess.status == 200
        self.sess.postForm('/auth/signup', 
            {'email': 'thebestuser@mail.com', 
            'password': 'ty435y5OPtyj', 
            'passwordRepeat': 'ty435y5OPtyj', 
            'username': 'foobar', 
            '_csrf': self.sess.csrf()
            })
        assert '>age<' in self.sess.content
        assert 'action="/auth/signup_final"' in self.sess.content #
        self.sess.postForm('/auth/signup_final', 
            {'age': '34', 
            'email': 'thebestuser@mail.com', 
            'password': 'ty435y5OPtyj', 
            'passwordRepeat': 'ty435y5OPtyj', 
            'username': 'foobar', 
            '_csrf': self.sess.csrf()
            })
        assert self.sess.redirect_url == '/'
        self.sess.follow_redirect()
        assert '>Welcome' in self.sess.content

    def test_cannot_become_admin_signup_custom(self):
        self.sess.reset()
        self.sess.get('/auth/signup')
        assert "Sign up" in self.sess.content
        assert ">username<" in self.sess.content
        assert self.sess.status == 200
        self.sess.postForm('/auth/signup', 
            {'email': 'thebestuse6r@mail.com', 
            'password': 'ty435y5OPtyj', 
            'passwordRepeat': 'ty435y5OPtyj', 
            'username': 'foobaz', 
            'role': 'admin',
            'role_id': '1',
            '_csrf': self.sess.csrf()
            })
        assert '>age<' in self.sess.content
        assert 'action="/auth/signup_final"' in self.sess.content #
        self.sess.postForm('/auth/signup_final', 
            {'age': '34', 
            'email': 'thebestuse6r@mail.com', 
            'password': 'ty435y5OPtyj', 
            'passwordRepeat': 'ty435y5OPtyj', 
            'username': 'foobaz', 
            'role': 'admin',
            'role_id': '1',
            '_csrf': self.sess.csrf()
            })
        assert self.sess.redirect_url == '/'
        self.sess.follow_redirect()
        assert '>Welcome' in self.sess.content
        self.cannot_access_admin()

    def test_cannot_become_admin_signup_custom1(self):
        self.sess.reset()
        self.sess.get('/auth/signup')
        assert "Sign up" in self.sess.content
        assert ">username<" in self.sess.content
        assert self.sess.status == 200
        self.sess.postForm('/auth/signup', 
            {'email': 'thebestuse7r@mail.com', 
            'password': 'ty435y5OPtyj', 
            'passwordRepeat': 'ty435y5OPtyj', 
            'username': 'foobap', 
            'role': '1',
            '_csrf': self.sess.csrf()
            })
        assert '>age<' in self.sess.content
        assert 'action="/auth/signup_final"' in self.sess.content #
        self.sess.postForm('/auth/signup_final', 
            {'age': '34', 
            'email': 'thebestuse7r@mail.com', 
            'password': 'ty435y5OPtyj', 
            'passwordRepeat': 'ty435y5OPtyj', 
            'username': 'foobap', 
            'role': '1',
            '_csrf': self.sess.csrf()
            })
        assert self.sess.redirect_url == '/'
        self.sess.follow_redirect()
        assert '>Welcome' in self.sess.content
        self.cannot_access_admin()