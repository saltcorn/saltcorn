const getApp = require("saltcorn/app");
const chaos_guinea_pig = require("chaos-guinea-pig");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  resetToFixtures
} = require("saltcorn/auth/testhelp");

beforeAll(async () => {
  await resetToFixtures();
});

describe("app", () => {
  it("obeys the chaos guinea pig", async done => {
    const app = await getApp();
    await chaos_guinea_pig(app);
    //expect(2).toBe(1);
    done();
  });
});

describe("app", () => {
  it("obeys the chaos guinea pig when logged in", async done => {
    const app = await getApp();
    const loginCookie = await getAdminLoginCookie();

    await chaos_guinea_pig(app, {
      cookie: loginCookie,
      stop_form_actions: ["delete"]
    });
    //expect(2).toBe(1);
    done();
  });
});
