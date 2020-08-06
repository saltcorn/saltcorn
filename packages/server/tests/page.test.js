const request = require("supertest");
const getApp = require("../app");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  toRedirect,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  resetToFixtures
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");

beforeAll(async () => {
  await resetToFixtures();
});
afterAll(db.close);

describe("db page", () => {
  it("shows to public", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/page/a_page")
      .expect(toInclude(">Bye bye<"));
  });
});

describe("pageedit", () => {
  it("show list", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/pageedit")
      .set("Cookie", loginCookie)

      .expect(toInclude("a_page"));
  });
  it("show edit", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/pageedit/edit/a_page")
      .set("Cookie", loginCookie)

      .expect(toInclude("A short name that will be in your URL"));
  });
  it("show new", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/pageedit/new")
      .set("Cookie", loginCookie)

      .expect(toInclude("A short name that will be in your URL"));
  });
});
