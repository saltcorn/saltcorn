from scsession import SaltcornSession

SaltcornSession.reset_to_fixtures()
sess = SaltcornSession(3001)
email = "admin@foo.com"
password="AhGGr6rhu45"

# helpers
def cannot_access_admin():
    sess.get('/table')
    assert sess.status == 302
    assert "Your tables" not in sess.content

def is_incorrect_user_or_password():
    assert sess.redirect_url == '/auth/login'
    sess.follow_redirect()
    assert "Incorrect user or password" in sess.content


def test_public_cannot_access_admin():
    sess.reset()
    cannot_access_admin()

def test_can_login_as_admin():
    sess.reset()
    sess.get('/auth/login')
    assert "Login" in sess.content
    assert sess.status == 200
    sess.postForm('/auth/login', 
        {'email': email, 
         'password': password, 
         '_csrf': sess.csrf()
        })
    assert sess.redirect_url == '/'
    sess.get('/table')
    assert sess.status == 200
    assert "Your tables" in sess.content

def test_login_without_csrf():
    sess.reset()
    sess.get('/auth/login')
    sess.postForm('/auth/login', 
        {'email': email, 
         'password': password,          
        })
    assert sess.redirect_url == '/auth/login'
    cannot_access_admin()

def test_login_with_wrong_csrf():
    sess.reset()
    sess.get('/auth/login')
    sess.postForm('/auth/login', 
        {'email': email, 
         'password': password,   
          '_csrf': 'ytjutydetjk'       
        })
    assert sess.redirect_url == '/auth/login'
    cannot_access_admin()

def test_login_with_blank_csrf():
    sess.reset()
    sess.get('/auth/login')
    sess.postForm('/auth/login', 
        {'email': email, 
         'password': password,   
          '_csrf': ''       
        })
    assert sess.redirect_url == '/auth/login'
    cannot_access_admin()

def test_login_with_wrong_password():
    sess.reset()
    sess.get('/auth/login')
    sess.postForm('/auth/login', 
        {'email': email, 
         'password': 'fidelio', 
         '_csrf': sess.csrf()     
        })
    is_incorrect_user_or_password()
    cannot_access_admin()

def test_login_with_no_password():
    sess.reset()
    sess.get('/auth/login')
    sess.postForm('/auth/login', {'email': email , '_csrf': sess.csrf()})
    is_incorrect_user_or_password()
    cannot_access_admin()

def test_login_with_no_email():
    sess.reset()
    sess.get('/auth/login')
    sess.postForm('/auth/login', {'password': password, '_csrf': sess.csrf()})
    is_incorrect_user_or_password()
    cannot_access_admin()

def test_login_with_blank_email():
    sess.reset()
    sess.get('/auth/login')
    sess.postForm('/auth/login', {'email':'', 'password': password, '_csrf': sess.csrf()})
    is_incorrect_user_or_password()
    cannot_access_admin()

def test_login_with_nothing():
    sess.reset()
    sess.get('/auth/login')
    sess.postForm('/auth/login', {'_csrf': sess.csrf()})
    is_incorrect_user_or_password()
    cannot_access_admin()

def test_login_with_blank_password():
    sess.reset()
    sess.get('/auth/login')
    sess.postForm('/auth/login', {'email': email,'password': '', '_csrf': sess.csrf()})
    is_incorrect_user_or_password()
    cannot_access_admin()