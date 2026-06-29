// File: tenant.test.js
import db from "@saltcorn/data/db";
import { request as request } from "../auth/testhelp.js";

import getApp from "../app.js";
import {
  toRedirect,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  resetToFixtures,
} from "../auth/testhelp.js";
import { getState } from "@saltcorn/data/db/state";
import Table from "@saltcorn/data/models/table";
import Field from "@saltcorn/data/models/field";
import User from "@saltcorn/data/models/user";
import { resToLoginCookie } from "../auth/testhelp.js";

afterAll(db.close);
jest.setTimeout(10000);

beforeAll(async () => {
  // initialise this process's schema (server tests run each file in its own
  // Postgres schema so they can run in parallel)
  await resetToFixtures();
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

    // A second, attacker-controlled tenant (e.g. one the attacker self-created
    // and is admin of). It holds no account in the victim tenant or the root.
    const ATTACKER_TENANT = "secauth2";
    const ATTACKER_ADMIN_EMAIL = "admin@secauth2.com";
    const ATTACKER_ADMIN_PW = "fidj38v8sdfaA2";

    // An admin-only fixture table in the ROOT (default) tenant. min_role_read=40
    // means a drifted role-1 sub-tenant admin would be allowed to read it, while
    // the public role (100) would not — so a successful read proves the drift.
    const ROOT_TABLE = "patients";

    const SECRET = "SECRET_TENANT_DATA_xyz";
    const TENANT_ADMIN_EMAIL = "admin@secauth.com";
    const TENANT_ADMIN_PW = "fidj38v8sdfaA1";
    // API tokens minted in each tenant for its own admin
    let tenantAdminToken; // admin of the victim tenant (secauth)
    let attackerAdminToken; // admin of the attacker tenant (secauth2)
    let foreignAdminToken; // admin of the default tenant

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

    // log in as the attacker tenant's own admin, against the attacker subdomain
    const getAttackerAdminLoginCookie = async () => {
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .post("/auth/login/")
        .set("Host", `${ATTACKER_TENANT}.example.com`)
        .send(`email=${ATTACKER_ADMIN_EMAIL}`)
        .send(`password=${ATTACKER_ADMIN_PW}`);
      return resToLoginCookie(res);
    };

    beforeAll(async () => {
      db.enable_multi_tenant();
      await getState().setConfig("role_to_create_tenant", "100");
      await db.query(`drop schema if exists ${TENANT} cascade`);
      await db.query(`drop schema if exists ${ATTACKER_TENANT} cascade`);
      const app = await getApp({ disableCsrf: true });
      await request(app)
        .post("/tenant/create")
        .send(`subdomain=${TENANT}`)
        .expect(toInclude("Success"));
      await request(app)
        .post("/tenant/create")
        .send(`subdomain=${ATTACKER_TENANT}`)
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
        const tadmin = await User.findOne({ email: TENANT_ADMIN_EMAIL });
        tenantAdminToken = await tadmin.getNewAPIToken();
      });

      // Seed an admin in the attacker tenant and mint its API token. This tenant
      // has no account in either the victim tenant or the root tenant.
      await db.runWithTenant(ATTACKER_TENANT, async () => {
        await User.create({
          email: ATTACKER_ADMIN_EMAIL,
          password: ATTACKER_ADMIN_PW,
          role_id: 1,
        });
        const aadmin = await User.findOne({ email: ATTACKER_ADMIN_EMAIL });
        attackerAdminToken = await aadmin.getNewAPIToken();
      });

      // mint an API token for the default tenant's admin (admin@foo.com)
      const fadmin = await User.findOne({ email: "admin@foo.com" });
      foreignAdminToken = await fadmin.getNewAPIToken();
    });

    afterAll(async () => {
      await db.query(`drop schema if exists ${TENANT} cascade`);
      await db.query(`drop schema if exists ${ATTACKER_TENANT} cascade`);
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

    // ---- API token (Bearer) variants ----

    // Negative: an API token minted for the default tenant's admin must not be
    // honoured against the victim tenant's subdomain. The token is looked up in
    // the request's resolved schema, so it should resolve to the public role
    // and be denied.
    it("rejects foreign-tenant API token on GET /api/:table/", async () => {
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/")
        .set("Authorization", `Bearer ${foreignAdminToken}`)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).not.toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(SECRET);
    });

    it("rejects foreign-tenant API token on GET /api/:table/count", async () => {
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/count")
        .set("Authorization", `Bearer ${foreignAdminToken}`)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).not.toBe(200);
      expect(res.body.success).not.toBe(1);
    });

    it("rejects foreign-tenant API token on GET /api/:table/distinct/:field", async () => {
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/distinct/data")
        .set("Authorization", `Bearer ${foreignAdminToken}`)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).not.toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(SECRET);
    });

    // Positive: the victim tenant's own API token, against the victim
    // subdomain, must read the data through the same /api endpoints.
    it("allows same-tenant API token on GET /api/:table/", async () => {
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/")
        .set("Authorization", `Bearer ${tenantAdminToken}`)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).toBe(200);
      expect(res.body.success).toEqual([{ id: 1, data: SECRET }]);
    });

    it("allows same-tenant API token on GET /api/:table/count", async () => {
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/count")
        .set("Authorization", `Bearer ${tenantAdminToken}`)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(1);
    });

    it("allows same-tenant API token on GET /api/:table/distinct/:field", async () => {
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/distinct/data")
        .set("Authorization", `Bearer ${tenantAdminToken}`)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).toBe(200);
      expect(res.body.success).toEqual([SECRET]);
    });

    // ---- sub-tenant -> sub-tenant (the headline SaaS attack) ----
    // The attacker is admin (role 1) of secauth2 and has NO account in secauth.
    // Replaying their secauth2 session against the secauth subdomain must not
    // read secauth's admin-only data.
    it("rejects sub-tenant->sub-tenant session reuse on GET /api/:table/", async () => {
      const loginCookie = await getAttackerAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/")
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).not.toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(SECRET);
    });

    it("rejects sub-tenant->sub-tenant session reuse on GET /api/:table/count", async () => {
      const loginCookie = await getAttackerAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/count")
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).not.toBe(200);
      expect(res.body.success).not.toBe(1);
    });

    it("rejects sub-tenant->sub-tenant session reuse on GET /api/:table/distinct/:field", async () => {
      const loginCookie = await getAttackerAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/distinct/data")
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).not.toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(SECRET);
    });

    // An API token minted in the attacker tenant is looked up in the victim
    // schema (where it does not exist), so it resolves to the public role and is
    // denied — the bearer path stays isolated in this direction too.
    it("rejects sub-tenant->sub-tenant API token on GET /api/:table/", async () => {
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/api/secrets/")
        .set("Authorization", `Bearer ${attackerAdminToken}`)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).not.toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(SECRET);
    });

    // ---- sub-tenant -> root (sub-tenant credentials on the root app) ----
    // The attacker is admin of secauth2 and has NO account in the root tenant.
    // Replaying their session against the root application (no subdomain) must
    // not read the root tenant's data. ROOT_TABLE has min_role_read=40, so a
    // leak here would mean the role-1 sub-tenant identity was applied to root.
    it("rejects sub-tenant->root session reuse on GET /api/:table/", async () => {
      const loginCookie = await getAttackerAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get(`/api/${ROOT_TABLE}/`)
        .set("Cookie", loginCookie);
      expect(res.status).not.toBe(200);
      expect(res.body.success).toBeUndefined();
    });

    it("rejects sub-tenant->root session reuse on GET /api/:table/count", async () => {
      const loginCookie = await getAttackerAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get(`/api/${ROOT_TABLE}/count`)
        .set("Cookie", loginCookie);
      expect(res.status).not.toBe(200);
      expect(res.body.success).toBeUndefined();
    });

    it("rejects sub-tenant->root session reuse on GET /api/:table/distinct/:field", async () => {
      const loginCookie = await getAttackerAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get(`/api/${ROOT_TABLE}/distinct/name`)
        .set("Cookie", loginCookie);
      expect(res.status).not.toBe(200);
      expect(res.body.success).toBeUndefined();
    });

    // The same for an API token minted in the attacker tenant: looked up in the
    // root schema (absent), it resolves to the public role and is denied.
    it("rejects sub-tenant->root API token on GET /api/:table/", async () => {
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get(`/api/${ROOT_TABLE}/`)
        .set("Authorization", `Bearer ${attackerAdminToken}`);
      expect(res.status).not.toBe(200);
      expect(res.body.success).toBeUndefined();
    });
  } else {
    it("does not support tenants on SQLite", () => {
      expect(db.isSQLite).toBe(true);
    });
  }
});
