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
const Table = require("@saltcorn/data/models/table");
const Field = require("@saltcorn/data/models/field");
const User = require("@saltcorn/data/models/user");
const { resToLoginCookie } = require("../auth/testhelp");

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
      await getState().setConfig("role_to_create_tenant", "100");

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
      await getState().setConfig("role_to_create_tenant", "100");

      const app = await getApp({ disableCsrf: true });
      await request(app)
        .post("/tenant/create")
        .send("subdomain=Peashoot")
        .expect(toInclude("Success"));
      db.set_sql_logging(false);
    });

    it("rejects existing tenant", async () => {
      db.enable_multi_tenant();
      await getState().setConfig("role_to_create_tenant", "100");
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

    /*it("delete tenant", async () => {
      const loginCookie = await getAdminLoginCookie();

      const app = await getApp({ disableCsrf: true });
      await request(app)
        .post("/tenant/delete/peashoot")
        .set("Cookie", loginCookie)
        .expect(toRedirect("/tenant/list"));
    });*/
  } else {
    it("does not support tenants on SQLite", async () => {
      expect(db.isSQLite).toBe(true);
    });
  }
});

describe("session-tenant isolation", () => {
  if (!db.isSQLite) {
    const TENANT = "secauth";

    const SECRET = "SECRET_TENANT_DATA_xyz";
    const TENANT_ADMIN_EMAIL = "admin@secauth.com";
    const TENANT_ADMIN_PW = "fidj38v8sdfaA1";

    // log in as the victim tenant's own admin, against the victim subdomain
    const getTenantAdminLoginCookie = async () => {
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .post("/auth/login/")
        .set("Host", `${TENANT}.example.com`)
        .send(`email=${TENANT_ADMIN_EMAIL}`)
        .send(`password=${TENANT_ADMIN_PW}`);
      return resToLoginCookie(res);
    };

    beforeAll(async () => {
      db.enable_multi_tenant();
      await getState().setConfig("role_to_create_tenant", "100");
      await db.query(`drop schema if exists ${TENANT} cascade`);
      const app = await getApp({ disableCsrf: true });
      await request(app)
        .post("/tenant/create")
        .send(`subdomain=${TENANT}`)
        .expect(toInclude("Success"));

      // Seed an admin-only (min_role_read = 1) table with a secret row in the
      // victim tenant. The admin@foo.com account exists only in the default
      // tenant, NOT in this one.
      await db.runWithTenant(TENANT, async () => {
        const t = await Table.create("secrets", {
          min_role_read: 1,
          min_role_write: 1,
        });
        await Field.create({
          table: t,
          name: "data",
          label: "data",
          type: "String",
        });
        await t.insertRow({ data: SECRET });
        await User.create({
          email: TENANT_ADMIN_EMAIL,
          password: TENANT_ADMIN_PW,
          role_id: 1,
        });
      });
    });

    afterAll(async () => {
      await db.query(`drop schema if exists ${TENANT} cascade`);
    });

    it("rejects cross-tenant session reuse", async () => {
      const loginCookie = await getAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/auth/settings")
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Session tenant mismatch");
    });

    // Regression test for the tenant-isolation bypass on the data API: a
    // session minted in the default tenant (admin, role 1) must not be able to
    // read another tenant's table data by replaying the cookie against the
    // victim subdomain's /api routes. The drift guard present on the HTML
    // routes must also apply here.
    it("rejects cross-tenant session reuse on GET /api/:table/", async () => {
      const loginCookie = await getAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/")
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).not.toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(SECRET);
    });

    it("rejects cross-tenant session reuse on GET /api/:table/count", async () => {
      const loginCookie = await getAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/count")
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).not.toBe(200);
      expect(res.body.success).not.toBe(1);
    });

    it("rejects cross-tenant session reuse on GET /api/:table/distinct/:field", async () => {
      const loginCookie = await getAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/distinct/data")
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).not.toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(SECRET);
    });

    // Positive controls: the victim tenant's own admin, authenticated against
    // the victim subdomain, must be able to read the data through the same
    // /api endpoints. This proves the drift guard rejects only genuine
    // cross-tenant drift and does not break legitimate same-tenant access.
    it("allows same-tenant session on GET /api/:table/", async () => {
      const loginCookie = await getTenantAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/")
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).toBe(200);
      expect(res.body.success).toEqual([{ id: 1, data: SECRET }]);
    });

    it("allows same-tenant session on GET /api/:table/count", async () => {
      const loginCookie = await getTenantAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/count")
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(1);
    });

    it("allows same-tenant session on GET /api/:table/distinct/:field", async () => {
      const loginCookie = await getTenantAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/distinct/data")
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).toBe(200);
      expect(res.body.success).toEqual([SECRET]);
    });
  } else {
    it("does not support tenants on SQLite", () => {
      expect(db.isSQLite).toBe(true);
    });
  }
});
