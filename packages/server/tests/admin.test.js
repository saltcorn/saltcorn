const request = require("supertest");
const getApp = require("../app");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  toRedirect,
  itShouldRedirectUnauthToLogin,
  toInclude,toSucceed,
  toNotInclude,
  resetToFixtures
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");

beforeAll(async () => {
  await resetToFixtures();
});
afterAll(db.close);

describe("admin page", () => {
  itShouldRedirectUnauthToLogin("/admin");
  it("show admin page", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/admin")
      .set("Cookie", loginCookie)
      .expect(toInclude("Restart"));
  });
  it("show download backup", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/admin/backup")
      .set("Cookie", loginCookie)
      .expect(toSucceed);
  });

});
