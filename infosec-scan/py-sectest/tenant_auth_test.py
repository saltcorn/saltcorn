from scsession import SaltcornSession



class Test:
    def setup_class(self):
        SaltcornSession.cli("reset-schema", "-f")
        SaltcornSession.cli("rm-tenant", "sub1")
        SaltcornSession.cli("rm-tenant", "sub2")
        SaltcornSession.cli("create-tenant", "sub1")
        SaltcornSession.cli("create-tenant", "sub2")
        SaltcornSession.cli("create-user", "-e","sub2@foo.com", "-a", "-p", "tyrh5h544yt45", "-t","sub2")
        SaltcornSession.cli("create-user", "-e","sub1@foo.com", "-a", "-p", "tyrh5h544yt46", "-t","sub1")
        SaltcornSession.cli("create-user", "-e","root@foo.com", "-a", "-p", "tyrh5h544yt47")
        self.sess = SaltcornSession(3001)
    def teardown_class(self):
        self.sess.close()
        SaltcornSession.cli("rm-tenant", "sub1")
        SaltcornSession.cli("rm-tenant", "sub2")

    def cannot_access_admin(self):
        self.sess.get('/table')
        assert self.sess.status == 302
        assert "Your tables" not in self.sess.content


    def test_sub_to_sub_cross_tenant(self):
        self.sess.reset()
        self.sess.base_url='http://sub1.example.com:3001/'
        self.sess.get('/auth/login')
        assert "Login" in self.sess.content
        assert self.sess.status == 200
        self.sess.postForm('/auth/login', 
            {'email': "sub1@foo.com", 
            'password': "tyrh5h544yt46", 
            '_csrf': self.sess.csrf()
            })
        assert self.sess.redirect_url == '/'
        self.sess.get('/table')
        assert self.sess.status == 200
        assert "Your tables" in self.sess.content
        self.sess.base_url='http://sub2.example.com:3001/'
        self.cannot_access_admin()

    def test_main_to_sub_cross_tenant(self):
        self.sess.reset()
        self.sess.base_url='http://example.com:3001/'
        self.sess.get('/auth/login')
        assert "Login" in self.sess.content
        assert self.sess.status == 200
        self.sess.postForm('/auth/login', 
            {'email': "root@foo.com", 
            'password': "tyrh5h544yt47", 
            '_csrf': self.sess.csrf()
            })
        assert self.sess.redirect_url == '/'
        self.sess.get('/table')
        assert self.sess.status == 200
        assert "Your tables" in self.sess.content
        self.sess.base_url='http://sub2.example.com:3001/'
        self.cannot_access_admin()
    def test_sub_to_main_cross_tenant(self):
        self.sess.reset()
        self.sess.base_url='http://sub1.example.com:3001/'
        self.sess.get('/auth/login')
        assert "Login" in self.sess.content
        assert self.sess.status == 200
        self.sess.postForm('/auth/login', 
            {'email': "sub1@foo.com", 
            'password': "tyrh5h544yt46", 
            '_csrf': self.sess.csrf()
            })
        assert self.sess.redirect_url == '/'
        self.sess.get('/table')
        assert self.sess.status == 200
        assert "Your tables" in self.sess.content
        self.sess.base_url='http://example.com:3001/'
        self.cannot_access_admin()
