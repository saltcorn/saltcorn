const db = require("../db");
const {
  getState,
  init_multi_tenant,
  create_tenant,
  restart_tenant,
} = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
const {
  createTenant,
  deleteTenant,
  getAllTenants,
} = require("../models/tenant");
const {
  getConfig,
} = require("../models/config");

afterAll(db.close);

beforeAll(async () => {
  if (!db.isSQLite) await db.query(`drop schema if exists test10 CASCADE `);
});

describe("Tenant", () => {
  if (!db.isSQLite) {
    it("can create a new tenant", async () => {
      db.enable_multi_tenant();
      getState().setConfig("base_url", "http://example.com/")
      await create_tenant("test10", () => {}, "http://test10.example.com/");
      db.runWithTenant("test10", async () => {
        const ten = db.getTenantSchema();
        expect(ten).toBe("test10");
        const base =  await getConfig("base_url")
        expect(base).toBe("http://test10.example.com/");

      });
      const tens = await getAllTenants();
      expect(tens).toContain("test10");
      expect(tens).not.toContain("public");
      await init_multi_tenant(() => {});
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
