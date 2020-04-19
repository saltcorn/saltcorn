const request = require("supertest");
const app = require("../app");

const toRedirect = loc => res => {
  if (res.statusCode !== 302) {
    console.log(res.text);
    throw new Error("Expected redirect, received " + res.statusCode);
  }
  const gotLoc = res.headers["location"];
  if (gotLoc !== loc) {
    throw new Error(`Expected location ${loc} received ${gotLoc}`);
  }
};

const toInclude = (txt, expCode = 200) => res => {
  if (res.statusCode !== expCode) {
    console.log(res.text);
    throw new Error(`Expected status ${expCode}, received ${res.statusCode}`);
  }

  if (!res.text.includes(txt)) {
    console.log(res.text);
    throw new Error(`Expected text ${txt} not found`);
  }
};

const toSucceed = (expCode = 200) => res => {
  if (res.statusCode !== expCode) {
    console.log(res.text);
    throw new Error(`Expected status ${expCode}, received ${res.statusCode}`);
  }
};

const toNotInclude = (txt, expCode = 200) => res => {
  if (res.statusCode !== expCode) {
    console.log(res.text);
    throw new Error(`Expected status ${expCode}, received ${res.statusCode}`);
  }

  if (res.text.includes(txt)) {
    console.log(res.text);
    throw new Error(`Expected text ${txt} to be absent, but was present`);
  }
};
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

const isReady = async app => {
  return new Promise((resolve, reject) => {
    app.on("ready", function() {
      resolve();
    });
  });
};

module.exports = {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toRedirect,
  toInclude,
  toNotInclude,
  toSucceed,
  isReady
};
