const app = require("./app");
const chaos_guinea_pig = require("chaos-guinea-pig");
const {
  getStaffLoginCookie,
  toRedirect,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  isReady
} = require("./auth/testhelp");
describe("app", () => {
  it("obeys the chaos guinea pig", async done => {
    await isReady(app);
    await chaos_guinea_pig(app);
    //expect(2).toBe(1);
    done();
  });
});
