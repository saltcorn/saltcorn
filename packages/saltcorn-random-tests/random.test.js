const getApp = require("saltcorn/app");
const chaos_guinea_pig = require("chaos-guinea-pig");
const {
  getStaffLoginCookie,
  toRedirect,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude, resetToFixtures
} = require("saltcorn/auth/testhelp");

beforeAll(async()=>{
  await resetToFixtures()
})

describe("app", () => {
  it("obeys the chaos guinea pig", async done => {
    const app = await getApp();
    await chaos_guinea_pig(app);
    //expect(2).toBe(1);
    done();
  });
});
