const request = require("supertest");
const app = require("../app");
const getApp = require("../app");
const fixtures = require("@saltcorn/data/db/fixtures");
const reset = require("@saltcorn/data/db/reset_schema");

const toRedirect = (loc) => (res) => {
  if (res.statusCode !== 302) {
    console.log(res.text);
    throw new Error("Expected redirect, received " + res.statusCode);
  }
  const gotLoc = res.headers["location"];
  if (gotLoc !== loc) {
    throw new Error(`Expected location ${loc} received ${gotLoc}`);
  }
};

const toInclude = (txt, expCode = 200) => (res) => {
  if (res.statusCode !== expCode) {
    console.log(res.text);
    throw new Error(
      `Expected status ${expCode} when lookinng for "${txt}", received ${res.statusCode}`
    );
  }

  if (!res.text.includes(txt)) {
    console.log(res.text);
    throw new Error(`Expected text ${txt} not found`);
  }
};

const toSucceed = (expCode = 200) => (res) => {
  if (res.statusCode !== expCode) {
    console.log(res.text);
    throw new Error(`Expected status ${expCode}, received ${res.statusCode}`);
  }
};

const toNotInclude = (txt, expCode = 200) => (res) => {
  if (res.statusCode !== expCode) {
    console.log(res.text);
    throw new Error(
      `Expected status ${expCode} when not lookinng for "${txt}", received ${res.statusCode}`
    );
  }

  if (res.text.includes(txt)) {
    console.log(res.text);
    throw new Error(`Expected text ${txt} to be absent, but was present`);
  }
};
const getStaffLoginCookie = async () => {
  const app = await getApp({ disableCsrf: true });
  const res = await request(app)
    .post("/auth/login/")
    .send("email=staff@foo.com")
    .send("password=ghrarhr54hg");
  if (res.statusCode !== 302) console.log(res.text);
  return res.headers["set-cookie"][0];
};

const getAdminLoginCookie = async () => {
  const app = await getApp({ disableCsrf: true });
  const res = await request(app)
    .post("/auth/login/")
    .send("email=admin@foo.com")
    .send("password=AhGGr6rhu45");
  if (res.statusCode !== 302) console.log(res.text);

  return res.headers["set-cookie"][0];
};

const itShouldRedirectUnauthToLogin = (path, dest) => {
  it(`should redirect unauth ${path} to ${dest || "login"}`, async () => {
    const app = await getApp({ disableCsrf: true });
    const res = await request(app)
      .get(path)
      .expect(302)
      .expect("Location", dest || "/auth/login");

    expect(res.statusCode).toEqual(302);
  });
};

const resetToFixtures = async () => {
  await reset();
  await fixtures();
};

const succeedJsonWith = (pred) => (res) => {
  if (res.statusCode !== 200) {
    console.log(res.text);
    throw new Error(`Expected status 200, received ${res.statusCode}`);
  }

  if (!pred(res.body.success)) {
    console.log(res.body);
    throw new Error(`Not satisfied`);
  }
};

const respondJsonWith = (code, pred) => (res) => {
  if (res.statusCode !== code) {
    console.log(res.text);
    throw new Error(`Expected status ${code}, received ${res.statusCode}`);
  }

  if (!pred(res.body)) {
    console.log(res.body);
    throw new Error(`Not satisfied`);
  }
};
const notAuthorized = (res) => {
  if (res.statusCode !== 401) {
    console.log(res.text);
    throw new Error(`Expected status 401, received ${res.statusCode}`);
  }
};
module.exports = {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toRedirect,
  toInclude,
  toNotInclude,
  toSucceed,
  resetToFixtures,
  succeedJsonWith,
  notAuthorized,
  respondJsonWith,
};
