import db from "@saltcorn/data/db/index";
const {
  getState,
  add_tenant,
  init_multi_tenant,
  restart_tenant,
} = require("@saltcorn/data/db/state");
getState().registerPlugin("base", require("@saltcorn/data/base-plugin"));
import tenant from "../models/tenant";
const {
  create_tenant,
  deleteTenant,
  getAllTenants,
  switchToTenant,
  insertTenant,
} = tenant;
import config from "@saltcorn/data/models/config";
const { getConfig } = config;
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

afterAll(db.close);

beforeAll(async () => {
  if (!db.isSQLite) await db.query(`drop schema if exists test10 CASCADE `);
});

describe("Tenant", () => {
  if (!db.isSQLite) {
    it("can create a new tenant", async () => {
      db.enable_multi_tenant();
      getState().setConfig("base_url", "http://example.com/");
      const tenant_template = getState().getConfig("tenant_template");
      await switchToTenant(
        await insertTenant("test10"),
        "http://test10.example.com/"
      );
      add_tenant("test10");
      await create_tenant({
        t: "test10",
        plugin_loader: () => {},
        tenant_template,
      });
      db.runWithTenant("test10", async () => {
        const ten = db.getTenantSchema();
        expect(ten).toBe("test10");
        const base = await getConfig("base_url");
        expect(base).toBe("http://test10.example.com/");
      });
      const tens = await getAllTenants();
      expect(tens).toContain("test10");
      expect(tens).not.toContain("public");
      await init_multi_tenant(() => {}, undefined, tens);
    });
    it("can restart a tenant", async () => {
      await db.runWithTenant("test10", async () => {
        await restart_tenant(() => {});
      });
    });
    it("can delete a tenant", async () => {
      db.enable_multi_tenant();
      await deleteTenant("test10");
    });
  } else {
    it("does not support tenants on SQLite", async () => {
      expect(db.isSQLite).toBe(true);
    });
  }
});
