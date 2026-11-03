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
import View from "@saltcorn/data/models/view";
import Page from "@saltcorn/data/models/page";
import File from "@saltcorn/data/models/file";
import { resToLoginCookie } from "../auth/testhelp.js";
import http from "http";
import WebSocket from "ws";
import { setupSocket } from "../serve.js";

afterAll(db.close);
jest.setTimeout(10000);

beforeAll(async () => {
  // initialise this process's schema (server tests run each file in its own
  // Postgres schema so they can run in parallel)
  await resetToFixtures();
  await db.drop_tenant_schema("test2");
  await db.drop_tenant_schema("peashoot");
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
    // a stand-in for a plugin route callback that trusts req.user without
    // doing its own tenant check - the pattern the dispatch-level guard
    // below has to protect, since plugin authors have no reason to expect
    // they need one
    const PLUGIN_ROUTE_URL = "/test-plugin-secret";
    const PLUGIN_SECRET = "PLUGIN_ROUTE_SECRET_abc";
    const TENANT_ADMIN_EMAIL = "admin@secauth.com";
    const TENANT_ADMIN_PW = "fidj38v8sdfaA1";
    // API tokens minted in each tenant for its own admin
    let tenantAdminToken; // admin of the victim tenant (secauth)
    let attackerAdminToken; // admin of the attacker tenant (secauth2)
    let foreignAdminToken; // admin of the default tenant
    let secretFilePath; // path_to_serve of an admin-only file in the victim tenant

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

    // a stand-in plugin route trusting only req.user - re-call this before
    // each request, since getApp() reloads plugin state and wipes it
    const registerPluginRoute = () =>
      db.runWithTenant(TENANT, async () => {
        getState().plugin_routes["_test_plugin_routes"] = [
          {
            url: PLUGIN_ROUTE_URL,
            method: "get",
            callback: (req, res) => {
              if (!req.user || req.user.role_id !== 1) {
                res.status(403).json({ error: "not authorized" });
                return;
              }
              res.json({ secret: PLUGIN_SECRET });
            },
          },
        ];
      });

    beforeAll(async () => {
      db.enable_multi_tenant();
      await getState().setConfig("role_to_create_tenant", "100");
      await db.drop_tenant_schema(TENANT);
      await db.drop_tenant_schema(ATTACKER_TENANT);
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
        // admin-only view, page and file holding the secret, for the
        // cross-tenant checks on the core HTML routes
        await View.create({
          table_id: t.id,
          name: "secretlist",
          viewtemplate: "List",
          configuration: {
            columns: [
              { type: "Field", field_name: "data", fieldview: "as_text" },
            ],
          },
          min_role: 1,
        });
        await Page.create({
          name: "secretpage",
          title: "Secret page",
          description: "",
          min_role: 1,
          layout: { type: "blank", contents: SECRET },
        });
        const f = await File.from_contents(
          "secretfile.txt",
          "text/plain",
          SECRET,
          tadmin.id,
          1
        );
        secretFilePath = f.path_to_serve;
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
      await db.drop_tenant_schema(TENANT);
      await db.drop_tenant_schema(ATTACKER_TENANT);
    });

    it("rejects cross-tenant session reuse", async () => {
      const loginCookie = await getAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/auth/settings")
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      // the foreign session is treated as logged out
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/auth/login");
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

    // ---- plugin routes ----
    // Regression test for the cross-tenant session replay reaching plugin
    // routes: unlike /api and /scapi, the plugin route dispatcher had no
    // drift guard of its own, so a session minted in the attacker tenant
    // could reach the victim tenant's plugin callback still carrying the
    // attacker's role.
    it("rejects sub-tenant->sub-tenant session reuse on a plugin route", async () => {
      const loginCookie = await getAttackerAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      await registerPluginRoute();
      const res = await request(app)
        .get(PLUGIN_ROUTE_URL)
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain(PLUGIN_SECRET);
    });

    // Positive control: the victim tenant's own admin, authenticated against
    // the victim subdomain, must still be able to reach its own plugin route.
    it("allows same-tenant session on a plugin route", async () => {
      const loginCookie = await getTenantAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      await registerPluginRoute();
      const res = await request(app)
        .get(PLUGIN_ROUTE_URL)
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).toBe(200);
      expect(res.body.secret).toBe(PLUGIN_SECRET);
    });
    // The drift guard must also cover the core HTML routes, not only /api,
    // /scapi and plugin routes: an attacker-tenant admin replaying their own
    // session against the victim subdomain must not get their role-1 applied
    // to the victim tenant's views, pages, files or rows.
    it("rejects sub-tenant->sub-tenant session reuse on GET /view/:viewname", async () => {
      const loginCookie = await getAttackerAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/view/secretlist")
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      expect(res.text || "").not.toContain(SECRET);
    });

    it("rejects sub-tenant->sub-tenant session reuse on GET /page/:pagename", async () => {
      const loginCookie = await getAttackerAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get("/page/secretpage")
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      expect(res.text || "").not.toContain(SECRET);
    });

    it("rejects sub-tenant->sub-tenant session reuse on GET /files/serve/*", async () => {
      const loginCookie = await getAttackerAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      const res = await request(app)
        .get(`/files/serve/${secretFilePath}`)
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`);
      expect(res.status).not.toBe(200);
      expect(res.text || "").not.toContain(SECRET);
    });

    it("rejects sub-tenant->sub-tenant session reuse on POST /delete/:table/:id", async () => {
      const id = await db.runWithTenant(TENANT, async () =>
        Table.findOne({ name: "secrets" }).insertRow({ data: "deleteme" })
      );
      const loginCookie = await getAttackerAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      await request(app)
        .post(`/delete/secrets/${id}`)
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`)
        .set("X-Requested-With", "XMLHttpRequest");
      const remaining = await db.runWithTenant(TENANT, async () => {
        const t = Table.findOne({ name: "secrets" });
        const n = await t.countRows({ id });
        await t.deleteRows({ id });
        return n;
      });
      expect(remaining).toBe(1);
    });

    it("allows same-tenant session on GET /view/:viewname", async () => {
      const loginCookie = await getTenantAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      await request(app)
        .get("/view/secretlist")
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`)
        .expect(toInclude(SECRET));
    });

    it("allows same-tenant session on GET /page/:pagename", async () => {
      const loginCookie = await getTenantAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      await request(app)
        .get("/page/secretpage")
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`)
        .expect(toInclude(SECRET));
    });

    it("allows same-tenant session on GET /files/serve/*", async () => {
      const loginCookie = await getTenantAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      await request(app)
        .get(`/files/serve/${secretFilePath}`)
        .set("Cookie", loginCookie)
        .set("Host", `${TENANT}.example.com`)
        .expect(200)
        .expect(toInclude(SECRET));
    });

    // The socket.io layer shares the session store with HTTP, so it needs the
    // same drift guard: an attacker-tenant session replayed over a websocket
    // whose Host names the victim tenant must not be bound to the victim
    // tenant. Both tenants' admins are user id 1, so without the guard the
    // attacker lands in the victim admin's per-user dynamic update room.
    describe("socket.io cross-tenant session replay", () => {
      let server, port;
      beforeAll(async () => {
        const app = await getApp({ disableCsrf: true });
        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        port = server.address().port;
        setupSocket(undefined, undefined, server);
      });
      afterAll(async () => {
        await new Promise((resolve) => server.close(resolve));
      });

      // minimal socket.io v4 client over a raw websocket
      const connectSocket = (cookie, host) =>
        new Promise((resolve, reject) => {
          const ws = new WebSocket(
            `ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`,
            { headers: { Cookie: cookie, Host: host } }
          );
          const acks = {};
          const events = [];
          let ackId = 0;
          const client = {
            events,
            emitWithAck: (event, ...args) =>
              new Promise((res) => {
                const id = ackId++;
                acks[id] = res;
                ws.send(`42${id}${JSON.stringify([event, ...args])}`);
              }),
            close: () => ws.close(),
          };
          ws.on("message", (buf) => {
            const msg = buf.toString();
            if (msg.startsWith("0")) ws.send("40");
            else if (msg === "2") ws.send("3");
            else if (msg.startsWith("40")) resolve(client);
            else if (msg.startsWith("44")) reject(new Error(msg));
            else if (msg.startsWith("43")) {
              const m = msg.match(/^43(\d+)(.*)$/);
              acks[m[1]]?.(JSON.parse(m[2])[0]);
            } else if (msg.startsWith("42"))
              events.push(JSON.parse(msg.slice(2)));
          });
          ws.on("error", reject);
        });

      const emitToVictimUserOne = async (payload) => {
        await db.runWithTenant(TENANT, async () => {
          const state = getState();
          state.hasJoinedDynamicUpdateSockets = true;
          state.emitDynamicUpdate(TENANT, payload, [1]);
        });
        await new Promise((r) => setTimeout(r, 300));
      };

      it("does not deliver victim-tenant dynamic updates to a cross-tenant session", async () => {
        const loginCookie = await getAttackerAdminLoginCookie();
        const sock = await connectSocket(
          loginCookie,
          `${TENANT}.example.com`
        );
        try {
          await sock.emitWithAck("join_dynamic_update_room");
          await emitToVictimUserOne({ notify: "XTENANT_SOCKET_MSG" });
          expect(JSON.stringify(sock.events)).not.toContain(
            "XTENANT_SOCKET_MSG"
          );
        } finally {
          sock.close();
        }
      });

      it("does not let a cross-tenant admin session join the log room", async () => {
        const loginCookie = await getAttackerAdminLoginCookie();
        const sock = await connectSocket(
          loginCookie,
          `${TENANT}.example.com`
        );
        try {
          const ack = await sock.emitWithAck("join_log_room");
          expect(ack.status).toBe("error");
        } finally {
          sock.close();
        }
      });

      it("delivers dynamic updates to a same-tenant session", async () => {
        const loginCookie = await getTenantAdminLoginCookie();
        const sock = await connectSocket(
          loginCookie,
          `${TENANT}.example.com`
        );
        try {
          const ack = await sock.emitWithAck("join_dynamic_update_room");
          expect(ack.status).toBe("ok");
          await emitToVictimUserOne({ notify: "SAMETENANT_SOCKET_MSG" });
          expect(JSON.stringify(sock.events)).toContain(
            "SAMETENANT_SOCKET_MSG"
          );
        } finally {
          sock.close();
        }
      });
    });
  } else {
    it("does not support tenants on SQLite", () => {
      expect(db.isSQLite).toBe(true);
    });
  }
});
