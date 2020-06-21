const db = require("../db");
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
const { createTenant, deleteTenant } = require("../models/tenant");

afterAll(db.close);

beforeAll(async () => {
  await db.query(`drop schema if exists test10 CASCADE `);
});

describe("Tenant", () => {
  it("can create a new tenant", async () => {
    db.enable_multi_tenant();
    await createTenant("test10");
  });
  it("can delete a tenant", async () => {
    db.enable_multi_tenant();
    await deleteTenant("test10");
  });
});
