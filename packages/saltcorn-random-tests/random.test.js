const getApp = require("@saltcorn/server/app");
const request = require("supertest");

const { chaos_guinea_pig, set_seed } = require("chaos-guinea-pig");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  resetToFixtures,
  toRedirect
} = require("@saltcorn/server/auth/testhelp");
const db = require("@saltcorn/data/db");
const { fetch_available_packs } = require("@saltcorn/data/models/pack");

beforeAll(async () => {
  await resetToFixtures();
});

afterAll(db.close);

jest.setTimeout(100000);

const seed = set_seed();

describe("app", () => {
  it("obeys the chaos guinea pig with seed " + seed, async () => {
    const packs_available = await fetch_available_packs();
    console.log(packs_available)
    
    for(const {name} of packs_available) {
      await resetToFixtures();
      const loginCookie = await getAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      await request(app)
        .post(`/packs/install-named/${encodeURIComponent(name)}`)
        .set("Cookie", loginCookie)
        .expect(toRedirect("/"));
      await chaos_guinea_pig(app);
    }
    

  });
});

/*describe("app", () => {
  it(
    "obeys the chaos guinea pig when logged in with seed " + seed,
    async () => {
      const app = await getApp({ disableCsrf: true });
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
      const app = await getApp({ disableCsrf: true });
      const loginCookie = await getAdminLoginCookie();

      const st = await chaos_guinea_pig(app, {
        steps: 500,
        cookie: loginCookie,
        stop_form_actions: ["delete", "restart", "upload", "auth"]
      });
      //console.log(st.log);
    }
  );
});*/
