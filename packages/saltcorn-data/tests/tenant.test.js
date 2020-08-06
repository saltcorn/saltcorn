const db = require("../db");
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
const { createTenant, deleteTenant } = require("../models/tenant");

afterAll(db.close);

beforeAll(async () => {
  if (!db.isSQLite) await db.query(`drop schema if exists test10 CASCADE `);
});

describe("Tenant", () => {
  if (!db.isSQLite) {
    it("can create a new tenant", async () => {
      db.enable_multi_tenant();
      await createTenant("test10");
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
