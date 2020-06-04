const getApp = require("@saltcorn/server/app");
const { chaos_guinea_pig, set_seed } = require("chaos-guinea-pig");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  resetToFixtures
} = require("@saltcorn/server/auth/testhelp");
const db = require("@saltcorn/data/db");

beforeAll(async () => {
  await resetToFixtures();
});

afterAll(db.close);

jest.setTimeout(100000);

const seed = set_seed();

describe("app", () => {
  it("obeys the chaos guinea pig with seed " + seed, async () => {
    const app = await getApp();
    await chaos_guinea_pig(app);
  });
});

describe("app", () => {
  it(
    "obeys the chaos guinea pig when logged in with seed " + seed,
    async () => {
      const app = await getApp();
      const loginCookie = await getAdminLoginCookie();

      const st = await chaos_guinea_pig(app, {
        steps: 100,
        cookie: loginCookie,
        stop_form_actions: ["delete", "upload", "restart"]
      });
      //console.log(st.log);
    }
  );
  it(
    "obeys the chaos guinea pig,excluding auth, when logged in with seed " +
      seed,
    async () => {
      const app = await getApp();
      const loginCookie = await getAdminLoginCookie();

      const st = await chaos_guinea_pig(app, {
        steps: 500,
        cookie: loginCookie,
        stop_form_actions: ["delete", "restart", "upload", "auth"]
      });
      //console.log(st.log);
    }
  );
});
