from sectest import Session

def test_login():
    sess = Session('https://saltcorn.com')
    sess.get('/auth/login')
    assert "Login" in sess.content
    assert sess.status == 200