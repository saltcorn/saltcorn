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
  resetToFixtures,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");

beforeAll(async () => {
  await resetToFixtures();
});
afterAll(db.close);

describe("db page", () => {
  it("shows to public", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/page/a_page").expect(toInclude(">Bye bye<"));
  });
  it("404s not found", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/page/b_page").expect(toInclude("not found", 404));
  });
});
describe("page create", () => {
  it("show new", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/pageedit/new")
      .set("Cookie", loginCookie)

      .expect(toInclude("A short name that will be in your URL"));
  });
  it("fills basic details", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/pageedit/edit")
      .send(
        "name=whales&title=Whales&description=about+whales&min_role=10&stepName=Identity&contextEnc=%257B%257D"
      )
      .set("Cookie", loginCookie)
      .expect(toInclude("builder.renderBuilder("));
  });
  it("fills layout", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/pageedit/edit")
      .send(
        "contextEnc=%257B%2522name%2522%253A%2522whales%2522%252C%2522title%2522%253A%2522Whales%2522%252C%2522description%2522%253A%2522about%2520whales%2522%252C%2522min_role%2522%253A%252210%2522%257D&stepName=Layout&columns=%255B%255D&layout=%257B%2522above%2522%253A%255B%257B%2522type%2522%253A%2522blank%2522%252C%2522contents%2522%253A%2522Hello%2520world%2522%252C%2522block%2522%253Afalse%252C%2522textStyle%2522%253A%2522%2522%257D%252C%257B%2522type%2522%253A%2522view%2522%252C%2522view%2522%253A%2522authorlist%2522%252C%2522name%2522%253A%2522d51d4b%2522%252C%2522state%2522%253A%2522fixed%2522%257D%255D%257D"
      )
      .set("Cookie", loginCookie)
      .expect(toInclude(">Fixed states<"));
  });
  it("fills fixed states", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/pageedit/edit")
      .send(
        "d51d4b__fts=&d51d4b_author=Melville&d51d4b__sortby=undefined&d51d4b__page=undefined&stepName=Fixed+states&contextEnc=%257B%2522name%2522%253A%2522whales%2522%252C%2522title%2522%253A%2522Whales%2522%252C%2522description%2522%253A%2522about%2520whales%2522%252C%2522min_role%2522%253A%252210%2522%252C%2522columns%2522%253A%255B%255D%252C%2522layout%2522%253A%257B%2522above%2522%253A%255B%257B%2522type%2522%253A%2522blank%2522%252C%2522contents%2522%253A%2522Hello%2520world%2522%252C%2522block%2522%253Afalse%252C%2522textStyle%2522%253A%2522%2522%257D%252C%257B%2522type%2522%253A%2522view%2522%252C%2522view%2522%253A%2522authorlist%2522%252C%2522name%2522%253A%2522d51d4b%2522%252C%2522state%2522%253A%2522fixed%2522%257D%255D%257D%257D"
      )
      .set("Cookie", loginCookie)
      .expect(toRedirect("/pageedit"));
  });
  it("shows page", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/page/whales")
      .set("Cookie", loginCookie)
      .expect(toInclude("Herman"));
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
      .send("stepName=Identity")
      .send("contextEnc=" + ctx)
      .expect(toInclude("builder.renderBuilder"));
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
