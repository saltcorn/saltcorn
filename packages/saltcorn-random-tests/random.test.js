const getApp = require("saltcorn/app");
const { chaos_guinea_pig, set_seed } = require("chaos-guinea-pig");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  resetToFixtures
} = require("saltcorn/auth/testhelp");
const db = require("saltcorn-data/db");

beforeAll(async () => {
  await resetToFixtures();
});

afterAll(db.close);

jest.setTimeout(20000);

const seed = set_seed();

describe("app", () => {
  it("obeys the chaos guinea pig with seed " + seed, async done => {
    const app = await getApp();
    await chaos_guinea_pig(app);
    //expect(2).toBe(1);
    done();
  });
});

describe("app", () => {
  it(
    "obeys the chaos guinea pig when logged in with seed " + seed,
    async done => {
      const app = await getApp();
      const loginCookie = await getAdminLoginCookie();

      const st = await chaos_guinea_pig(app, {
        steps: 300,
        cookie: loginCookie,
        stop_form_actions: ["delete"]
      });
      //console.log(st.log);
      done();
    }
  );
});
