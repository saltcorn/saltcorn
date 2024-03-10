const request = require("supertest");
const getApp = require("../app");
const {
  toRedirect,
  getAdminLoginCookie,
  getStaffLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  resetToFixtures,
  succeedJsonWith,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");

beforeAll(async () => {
  await resetToFixtures();
});
afterAll(db.close);

jest.setTimeout(30000);

describe("Help topics", () => {
  itShouldRedirectUnauthToLogin("/admin/help/View%20patterns");

  it("should show view patterns help", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/admin/help/View patterns")
      .set("Cookie", loginCookie)
      .expect(toInclude("<title>Help: View patterns</title>"))
      .expect(toInclude("The view pattern is a fundamental concept"));
  });
});
