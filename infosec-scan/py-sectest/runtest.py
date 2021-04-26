from sectest import Session

sess= Session('https://saltcorn.com')

sess.get('/auth/login')

assert sess.status == 201