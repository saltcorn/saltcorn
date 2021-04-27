from scsession import SaltcornSession

SaltcornSession.reset_to_fixtures()
sess = SaltcornSession(3000)

# helpers
def cannot_access_admin():
    sess.get('/table')
    assert sess.status == 302
    assert "Your tables" not in sess.content

def test_public_home_is_redirect():
    sess.reset()
    sess.get('/')
    assert sess.redirect_url == '/auth/login'
    cannot_access_admin()

def test_can_signup():
    sess.reset()
    sess.get('/auth/signup')
    assert "Sign up" in sess.content
    assert sess.status == 200
    sess.postForm('/auth/signup', 
        {'email': 'thebestuser@mail.com', 
         'password': 'ty435y5OPtyj', 
         '_csrf': sess.csrf()
        })
    assert sess.redirect_url == '/'
    sess.follow_redirect()
    assert 'Welcome to Saltcorn!' in sess.content
    cannot_access_admin()
    sess.get('/auth/logout')
    assert sess.redirect_url == '/auth/login'
    sess.follow_redirect()
    sess.postForm('/auth/login', 
        {'email': 'thebestuser@mail.com', 
         'password': 'ty435y5OPtyj', 
         '_csrf': sess.csrf()
        })
    assert sess.redirect_url == '/'

def test_cannot_signup_again():
    sess.reset()
    sess.get('/auth/signup') 
    sess.postForm('/auth/signup', 
        {'email': 'thebestuser@mail.com', 
         'password': 'ty435y5OPtyj', 
         '_csrf': sess.csrf()
        })
    assert sess.redirect_url == '/auth/signup'

def test_signup_no_csrf():
    sess.reset()
    sess.get('/auth/signup')
    sess.postForm('/auth/signup', 
        {'email': 'thebestus2er@mail.com', 
         'password': 'ty435yqpiOPtyj', 
        })
    assert sess.redirect_url == '/'
    sess.follow_redirect()
    assert sess.redirect_url == '/auth/login'
    sess.follow_redirect()
    sess.postForm('/auth/login', 
        {'email': 'thebestus2er@mail.com', 
         'password': 'ty435yqpiOPtyj', 
         '_csrf': sess.csrf()
        })
    assert sess.redirect_url == '/auth/login'
    sess.follow_redirect()
    assert "Incorrect user or password" in sess.content

def test_cannot_inject_role_id():
    sess.reset()
    sess.get('/auth/signup')
    assert "Sign up" in sess.content
    assert sess.status == 200
    sess.postForm('/auth/signup', 
        {'email': 'theworstuser@mail.com', 
         'password': 'ty11y5OPtyj', 
         'role_id': '1',
         '_csrf': sess.csrf()
        })
    assert sess.redirect_url == '/'
    sess.follow_redirect()
    cannot_access_admin()
