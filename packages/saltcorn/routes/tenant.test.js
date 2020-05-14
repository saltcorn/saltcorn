const db = require("saltcorn-data/db");
const request = require("supertest");

const getApp = require("../app");
const {
  toRedirect,
  getAdminLoginCookie,
  getStaffLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude
} = require("../auth/testhelp");

afterAll(db.close);

beforeAll(async ()=>{
    db.query(`drop schema if exists test2`)
})

describe("tenant routes", () => {
    it("creates tenant", async () => {
        const app = await getApp();
    await request(app)
      .post("/tenant/create")
      .send("subdomain=test2")
      .send("email=foo@bar.com")
      .send("password=secret")
      .expect(toInclude("Success"));
    })
})