// File: tenant.test.js
const db = require("@saltcorn/data/db");
const request = require("supertest");

const getApp = require("../app");
const {
  toRedirect,
  getAdminLoginCookie,
  //getStaffLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  //toNotInclude,
} = require("../auth/testhelp");
const { getState } = require("@saltcorn/data/db/state");

afterAll(db.close);
jest.setTimeout(10000);


beforeAll(async () => {
  if (!db.isSQLite) {
    await db.query(`drop schema if exists test2 cascade`);
    await db.query(`drop schema if exists peashoot cascade`);
  }
});

describe("tenant routes", () => {
  if (!db.isSQLite) {
    it("shows create form", async () => {
      db.enable_multi_tenant();
      await getState().setConfig("role_to_create_tenant", "10");

      const app = await getApp({ disableCsrf: true });
      await request(app).get("/tenant/create").expect(toInclude("subdomain"));
    });

    it("creates tenant", async () => {
      const app = await getApp({ disableCsrf: true });
      await request(app)
        .post("/tenant/create")
        .send("subdomain=test2")
        .expect(toInclude("Success"));
    });

    it("creates tenant with capital letter", async () => {
      db.enable_multi_tenant();
      await getState().setConfig("role_to_create_tenant", "10");

      const app = await getApp({ disableCsrf: true });
      await request(app)
        .post("/tenant/create")
        .send("subdomain=Peashoot")
        .expect(toInclude("Success"));
      db.set_sql_logging(false);
    });

    it("rejects existing tenant", async () => {
      db.enable_multi_tenant();
      await getState().setConfig("role_to_create_tenant", "10");
      const app = await getApp({ disableCsrf: true });
      await request(app)
        .post("/tenant/create")
        .send("subdomain=test2")
        .expect(toInclude("already exists"));
    });
    itShouldRedirectUnauthToLogin("/tenant/list");

    it("lists tenants", async () => {
      const loginCookie = await getAdminLoginCookie();

      const app = await getApp({ disableCsrf: true });
      await request(app)
        .get("/tenant/list")
        .set("Cookie", loginCookie)
        .expect(toInclude("peashoot"));
    });

    it("show tenant info", async () => {
      const loginCookie = await getAdminLoginCookie();

      const app = await getApp({ disableCsrf: true });
      await request(app)
        .get("/tenant/info/peashoot")
        .set("Cookie", loginCookie)
        .expect(toInclude("E-mail"));
    });

    it("delete tenant", async () => {
      const loginCookie = await getAdminLoginCookie();

      const app = await getApp({ disableCsrf: true });
      await request(app)
        .post("/tenant/delete/peashoot")
        .set("Cookie", loginCookie)
        .expect(toRedirect("/tenant/list"));
    });

  } else {

    it("does not support tenants on SQLite", async () => {
      expect(db.isSQLite).toBe(true);
    });

  }
});
