from scsession import SaltcornSession

def test_login():
    sess = SaltcornSession(3000)
    sess.get('/auth/login')
    assert "Login" in sess.content
    assert sess.status == 200