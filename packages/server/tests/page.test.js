const request = require("supertest");
const getApp = require("../app");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  toRedirect,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toSucceed,
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

    //TODO full context
    const ctx = encodeURIComponent(JSON.stringify({}));
    await request(app)
      .post("/pageedit/edit")
      .set("Cookie", loginCookie)
      .send("name=a_page")
      .send("stepName=Page")
      .send("contextEnc=" + ctx)
      .expect(toInclude("builder.renderBuilder"));
  });
  it("show new", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/pageedit/new")
      .set("Cookie", loginCookie)

      .expect(toInclude("A short name that will be in your URL"));
  });
  it("sets root page", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/pageedit/set_root_page")
      .send("public_home=a_page")
      .send("staff_home=")
      .send("user_home=")
      .send("admin_home=")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/pageedit"));
    await request(app)
      .get("/pageedit")
      .set("Cookie", loginCookie)

      .expect(toInclude("Root pages updated"));
  });
  it("should delete page", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/pageedit/delete/1")
      .set("Cookie", loginCookie)

      .expect(toRedirect("/pageedit"));

    await request(app)
      .get("/pageedit")
      .set("Cookie", loginCookie)

      .expect(toNotInclude("a_page"));
  });
});
