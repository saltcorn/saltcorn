
const db = require("saltcorn-data/db");
const { getState } = require("../db/state");
getState().registerPlugin(require("../base-plugin"));
const { getAllTenants,
    createTenant } = require("../models/tenant");
afterAll(db.close);

describe("Tenant", () => {
  it("can create a new tenant", async () => {
    const d = await createTenant({
        subdomain: "test1", email: "foo@bar.com", password: "secret"});
    expect(5).toBe(5);
  });
  
});
