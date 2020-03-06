const request = require("supertest");
const app = require("../app");

const getStaffLoginCookie = async () => {
  const res = await request(app)
    .post("/auth/login/")
    .send("email=staff@foo.com")
    .send("password=secret");
  if (res.statusCode !== 302) console.log(res.text);
  return res.headers["set-cookie"][0];
};

const getAdminLoginCookie = async () => {
  const res = await request(app)
    .post("/auth/login/")
    .send("email=admin@foo.com")
    .send("password=secret");
  if (res.statusCode !== 302) console.log(res.text);

  return res.headers["set-cookie"][0];
};

const itShouldRedirectUnauthToLogin = path => {
  it(`should redirect unauth ${path} to login`, async done => {
    const res = await request(app)
      .get(path)
      .expect("Location", "/auth/login");

    expect(res.statusCode).toEqual(302);
    done();
  });
};

module.exports = {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin
};
