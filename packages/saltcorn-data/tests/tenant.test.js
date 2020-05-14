const db = require("saltcorn-data/db");
const { getState } = require("../db/state");
getState().registerPlugin(require("../base-plugin"));
const { getAllTenants, createTenant } = require("../models/tenant");
afterAll(db.close);

describe("Tenant", () => {
  it("can create a new tenant", done => {
    db.tenantNamespace.run(() => {
      createTenant({
        subdomain: "test1",
        email: "foo@bar.com",
        password: "secret"
      })
        .then(v => {
          expect(5).toBe(5);
          console.log(v);

          //db.query(`drop schema test1;`).then(() => );
        })
        .catch(err => {
          console.log(err);
          done();
        })
        .finally(() => done());
    });
  });
});
