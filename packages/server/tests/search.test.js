const request = require("supertest");
const getApp = require("../app");
const Table = require("@saltcorn/data/models/table");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toRedirect,
  toNotInclude,
  resetToFixtures,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");

afterAll(db.close);

beforeAll(async () => {
  await resetToFixtures();
});

describe("Search config Endpoints", () => {
  itShouldRedirectUnauthToLogin("/search/config");

  it("should show search config form", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/search/config")
      .set("Cookie", loginCookie)
      .expect(toInclude("Result preview for books"));
  });
  it("should set search view", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/search/config/")
      .send("books=authorshow")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/search/config"));
  });
  it("should show search form", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/search").expect(toInclude("Search all tables"));
  });
  it("should show search form", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/search?q=Tolstoy").expect(toInclude("Leo"));
  });
  it("should show search form", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/search?q=Melville").expect(toNotInclude("Leo"));
  });
});
