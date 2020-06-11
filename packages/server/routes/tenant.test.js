const db = require("@saltcorn/data/db");
const request = require("supertest");

const getApp = require("../app");
const {
  toRedirect,
  getAdminLoginCookie,
  getStaffLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude
} = require("../auth/testhelp");

afterAll(db.close);

beforeAll(async () => {
  await db.query(`drop schema if exists test2 cascade`);
  await db.query(`drop schema if exists peashoot cascade`);
});

describe("tenant routes", () => {
  it("creates tenant", async () => {
    db.enable_multi_tenant();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/tenant/create")
      .send("subdomain=test2")
      .expect(toInclude("Success"));
    expect(1).toBe(1);
  });
  it("creates tenant with capital letter", async () => {
    db.enable_multi_tenant();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/tenant/create")
      .send("subdomain=Peashoot")
      .expect(toInclude("Success"));
    db.set_sql_logging(false);

    expect(1).toBe(1);
  });
});
