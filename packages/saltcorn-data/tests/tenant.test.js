const db = require("@saltcorn/data/db");
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
const { createTenant } = require("../models/tenant");

afterAll(db.close);

beforeAll(async () => {
  await db.query(`drop schema if exists test10 CASCADE `);
});

describe("Tenant", () => {
  it("can create a new tenant", async () => {
    db.enable_multi_tenant();
    await createTenant({
      subdomain: "test10",
      email: "foo@bar.com",
      password: "secret"
    });
  });
});
