from sectest import Session

def test_login():
    sess= Session('https://saltcorn.com')
    sess.get('/auth/login')
    assert sess.status == 200