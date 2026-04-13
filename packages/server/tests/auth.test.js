const request = require("supertest");
const getApp = require("../app");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const Field = require("@saltcorn/data/models/field");
const User = require("@saltcorn/data/models/user");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  toRedirect,
  toInclude,
  toSucceed,
  resetToFixtures,
  toNotInclude,
  resToLoginCookie,
  succeedJsonWith,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const { get_reset_link, generate_email } = require("../auth/resetpw");
const i18n = require("i18n");
const path = require("path");
const fs = require("fs");
const { sleep } = require("@saltcorn/data/utils");

afterAll(async () => {
  await sleep(100);
  db.close();
});
beforeAll(async () => {
  await resetToFixtures();
});

describe("AuthTest Public auth Endpoints", () => {
  it("should show login", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/auth/login/")
      .expect(toSucceed())
      .expect(toInclude("E-mail"));
  });

  it("should show signup", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/auth/signup/").expect(toSucceed());
  });

  it("should allow logout for unauth user", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/auth/logout/").expect(toRedirect("/auth/login"));
  });
});

describe("AuthTest login process", () => {
  it("should say Login when not logged in", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/").expect(toRedirect("/auth/login"));
  });

  it("should say Logout when logged in", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/")
      .set("Cookie", loginCookie)
      .expect(toInclude("Logout"));
  });
});

describe("AuthTest user settings", () => {
  let loginCookie;
  it("should show user settings", async () => {
    const app = await getApp({ disableCsrf: true });
    loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/auth/settings")
      .set("Cookie", loginCookie)
      .expect(toInclude(">staff@foo.com<"));
  });

  it("should change password", async () => {
    const app = await getApp({ disableCsrf: true });
    //const loginCookie = await getStaffLoginCookie();
    await request(app)
      .post("/auth/settings")
      .set("Cookie", loginCookie)
      .send("password=ghrarhr54hg")
      .send("new_password=foHRrr46obar")
      .expect(toRedirect("/auth/settings"));
    await request(app)
      .get("/auth/settings")
      .set("Cookie", loginCookie)
      .expect(toInclude("Password changed"));
    const user = await User.findOne({ email: "staff@foo.com" });
    expect(user.checkPassword("foHRrr46obar")).toBe(true);
    expect(user.checkPassword("ghrarhr54hg")).toBe(false);
  });
  it("can login with new password", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/auth/login/")
      .send("email=staff@foo.com")
      .send("password=foHRrr46obar")
      .expect(toRedirect("/"));
    //change back
    await request(app)
      .post("/auth/settings")
      .set("Cookie", loginCookie)
      .send("password=foHRrr46obar")
      .send("new_password=ghrarhr54hg")
      .expect(toRedirect("/auth/settings"));
  });
  it("should needs correct old password", async () => {
    const app = await getApp({ disableCsrf: true });
    //const loginCookie = await getStaffLoginCookie();
    await request(app)
      .post("/auth/settings")
      .set("Cookie", loginCookie)
      .send("password=ghrarhr55hg") //wrong
      .send("new_password=foHRrr46obar")
      .expect(toInclude("Password does not match"))
      .expect(200);
    const user = await User.findOne({ email: "staff@foo.com" });
    expect(user.checkPassword("foHRrr46obar")).toBe(false);
    expect(user.checkPassword("ghrarhr54hg")).toBe(true);
  });
  it("should needs old password value", async () => {
    const app = await getApp({ disableCsrf: true });
    //const loginCookie = await getStaffLoginCookie();
    await request(app)
      .post("/auth/settings")
      .set("Cookie", loginCookie)
      .send("new_password=foHRrr46obar")
      .expect(toInclude("Unable to read"))
      .expect(200);
    const user = await User.findOne({ email: "staff@foo.com" });
    expect(user.checkPassword("foHRrr46obar")).toBe(false);
    expect(user.checkPassword("ghrarhr54hg")).toBe(true);
  });

  it("should change language", async () => {
    const app = await getApp({ disableCsrf: true });
    const adminLoginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .post("/auth/setlanguage")
      .set("Cookie", adminLoginCookie)
      .send("locale=it")
      .expect(toRedirect("/auth/settings"));
    const newCookie = resToLoginCookie(res);
    await request(app)
      .get("/auth/settings")
      .set("Cookie", newCookie)
      .expect(toInclude("Cambia password"));
  });
});

describe("AuthTest signup process", () => {
  it("should sign up", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/auth/signup/")
      .send("email=staff1@foo.com")
      .send("password=seCERGERG45et")
      .expect(toRedirect("/"));
  });
});

describe("AuthTest forgot password", () => {
  it("should show form", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/auth/forgot/").expect(toRedirect("/auth/login"));
    await getState().setConfig("allow_forgot", true);
    await request(app)
      .get("/auth/forgot/")
      .expect(toSucceed())
      .expect(toInclude("send you a link to reset your password"));
  });

  it("load reset form", async () => {
    const u = await User.findOne({ email: "staff1@foo.com" });
    await getState().setConfig("base_url", "/");

    const { link } = await get_reset_link(u, {});

    i18n.configure({
      locales: ["en"],
      directory: path.join(__dirname, "..", "/locales"),
    });
    const email = generate_email(link, u, i18n);
    expect(email.text).toContain(link);
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get(link)
      .expect(toSucceed())
      .expect(toInclude("Enter your new password below"));
    const token = await u.getNewResetToken();
    await request(app)
      .post("/auth/reset")
      .send("email=staff1@foo.com")
      .send("password=bazzRGGR65zoo")
      .send("confirm_password=bazzRGGR65zoo")
      .send("token=" + token)
      .expect(toRedirect("/auth/login"));
    await request(app)
      .post("/auth/login/")
      .send("email=staff1@foo.com")
      .send("password=seCERGERG45et")
      .expect(toRedirect("/auth/login"));
    await request(app)
      .post("/auth/login/")
      .send("email=staff1@foo.com")
      .send("password=bazzRGGR65zoo")
      .expect(toRedirect("/"));
  });
});

describe("AuthTest user admin", () => {
  it("should list tables", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/useradmin/")
      .set("Cookie", loginCookie)
      .expect(toSucceed())
      .expect(toInclude("staff@foo.com"));
  });
  it("shows new user form", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/useradmin/new")
      .set("Cookie", loginCookie)
      .expect(toSucceed());
  });
  it("creates new user", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/useradmin/save")
      .send("email=staff2@foo.com")
      .send("password=fideRGE54lio")
      .send("role_id=80")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/useradmin"));
  });

  it("can login with new user", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/auth/login/")
      .send("email=staff2@foo.com")
      .send("password=fideRGE54lio")
      .expect(toRedirect("/"));
  });

  it("shows edit user form", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    const user = await User.findOne({ email: "staff2@foo.com" });
    expect(user.role_id).toBe(80);
    await request(app)
      .get(`/useradmin/${user.id}`)
      .set("Cookie", loginCookie)
      .expect(toSucceed());
  });

  it("edits user", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    const user = await User.findOne({ email: "staff2@foo.com" });
    await request(app)
      .post("/useradmin/save")
      .send("email=staff2@foo.com")
      .send(`id=${user.id}`)
      .send("role_id=40")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/useradmin"));
    const edituser = await User.findOne({ email: "staff2@foo.com" });
    expect(edituser.role_id).toBe(40);
  });
  it("tries to create new user with existing email", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/useradmin/save")
      .send("email=staff2@foo.com")
      .send("password=fideRGE54lio")
      .send("role_id=80")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/useradmin"));
    const editusers = await User.find({ email: "staff2@foo.com" });
    expect(editusers.length).toBe(1);
  });
  it("deletes user", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    const user = await User.findOne({ email: "staff2@foo.com" });
    await request(app)
      .post(`/useradmin/delete/${user.id}`)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/useradmin"));
    const delusers = await User.find({ email: "staff2@foo.com" });
    expect(delusers.length).toBe(0);
  });
  if (!db.isSQLite)
    it("can be disabled", async () => {
      const staffLoginCookie = await getStaffLoginCookie();
      const staffUser = await User.findOne({ email: "staff@foo.com" });
      const adminLoginCookie = await getAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      await request(app)
        .post("/auth/login/")
        .send("email=staff@foo.com")
        .send("password=ghrarhr54hg")
        .expect(toRedirect("/"));
      await request(app)
        .post(`/useradmin/disable/${staffUser.id}`)
        .set("Cookie", adminLoginCookie)
        .expect(toRedirect("/useradmin"));
      await request(app)
        .get("/auth/settings")
        .set("Cookie", staffLoginCookie)
        .expect(toRedirect("/auth/login"));
      await request(app)
        .post("/auth/login/")
        .send("email=staff@foo.com")
        .send("password=ghrarhr54hg")
        .expect(toRedirect("/auth/login"));
      await request(app)
        .post(`/useradmin/enable/${staffUser.id}`)
        .set("Cookie", adminLoginCookie)
        .expect(toRedirect("/useradmin"));
      await request(app)
        .post("/auth/login/")
        .send("email=staff@foo.com")
        .send("password=ghrarhr54hg")
        .expect(toRedirect("/"));
    });
  if (!db.isSQLite)
    it("can be force logged out", async () => {
      const staffLoginCookie = await getStaffLoginCookie();
      const staffUser = await User.findOne({ email: "staff@foo.com" });
      const adminLoginCookie = await getAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      await request(app)
        .get("/auth/settings")
        .set("Cookie", staffLoginCookie)
        .expect(toInclude(">staff@foo.com<"));
      await request(app)
        .post(`/useradmin/force-logout/${staffUser.id}`)
        .set("Cookie", adminLoginCookie)
        .expect(toRedirect("/useradmin"));
      await request(app)
        .get("/auth/settings")
        .set("Cookie", staffLoginCookie)
        .expect(toRedirect("/auth/login"));
      await request(app)
        .post("/auth/login/")
        .send("email=staff@foo.com")
        .send("password=ghrarhr54hg")
        .expect(toRedirect("/"));
    });
});
describe("AuthTest User fields", () => {
  it("should add fields", async () => {
    const table = Table.findOne({ name: "users" });
    await Field.create({
      table,
      label: "Height",
      type: "Integer",
    });
    await View.create({
      table_id: table.id,
      name: "newuser",
      viewtemplate: "Edit",
      configuration: {
        columns: [
          { type: "Field", fieldview: "edit", field_name: "height" },
          { type: "Action", minRole: 100, action_name: "Save" },
        ],
        layout: {
          above: [
            {
              widths: [2, 10],
              besides: [
                {
                  above: [
                    null,
                    { type: "blank", contents: "Height", isFormula: {} },
                  ],
                },
                {
                  above: [
                    null,
                    {
                      type: "field",
                      fieldview: "edit",
                      field_name: "height",
                    },
                  ],
                },
              ],
            },
            { type: "line_break" },
            { type: "action", minRole: 100, action_name: "Save" },
          ],
        },
      },
      min_role: 100,
    });
    await getState().setConfig("new_user_form", "newuser");
  });
  it("should sign up", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/auth/signup/")
      .send("email=staff14@foo.com")
      .send("password=seCERGERG45et")
      .expect(200)
      .expect(toInclude("/auth/signup_final"))
      .expect(toInclude("seCERGERG45et"))
      .expect(toInclude(">Height<"));
  });
  it("should sign up with new user form", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/auth/signup_final")
      .send("email=staff14@foo.com")
      .send("password=seCERGERG45et")
      .send("height=191")
      .expect(toRedirect("/"));
    const table = Table.findOne({ name: "users" });
    const ut = await table.getRow({ email: "staff14@foo.com" });
    expect(ut.email).toBe("staff14@foo.com");
    expect(ut.height).toBe(191);
  });
});

describe("AuthTest signup with custom login form", () => {
  it("should create user fields and login form", async () => {
    const table = Table.findOne({ name: "users" });
    const fc = await Field.create({
      table,
      label: "Username",
      type: "String",
      required: false,
    });
    await View.create({
      name: "loginform",
      viewtemplate: "Edit",
      table_id: table.id,
      configuration: {
        fixed: { email: "", preset_email: "" },
        layout: {
          above: [
            {
              widths: [2, 10],
              besides: [
                {
                  above: [
                    null,
                    { type: "blank", contents: "Username", isFormula: {} },
                  ],
                },
                {
                  above: [
                    null,
                    {
                      type: "field",
                      fieldview: "edit",
                      field_name: "username",
                    },
                  ],
                },
              ],
            },
            { type: "line_break" },
            {
              widths: [2, 10],
              besides: [
                {
                  above: [
                    null,
                    { type: "blank", contents: "Password", isFormula: {} },
                  ],
                },
                {
                  above: [
                    {
                      type: "field",
                      fieldview: "password",
                      field_name: "password",
                    },
                    null,
                  ],
                },
              ],
            },
            { type: "line_break" },
            {
              type: "action",
              rndid: "63f01b",
              minRole: 100,
              isFormula: {},
              action_name: "Login",
              action_label: "Login",
              action_style: "btn-primary",
              configuration: {},
            },
            {
              type: "action",
              rndid: "45dd57",
              minRole: 100,
              isFormula: {},
              action_name: "Login with github",
              configuration: {},
            },
          ],
        },
        columns: [
          { type: "Field", fieldview: "edit", field_name: "username" },
          { type: "Field", fieldview: "password", field_name: "password" },
          {
            type: "Action",
            rndid: "63f01b",
            minRole: 100,
            isFormula: {},
            action_name: "Login",
            action_label: "Login",
            action_style: "btn-primary",
            configuration: {},
          },
          {
            type: "Action",
            rndid: "45dd57",
            minRole: 100,
            isFormula: {},
            action_name: "Login with github",
            configuration: {},
          },
        ],
        viewname: "loginform",
        view_when_done: "publicissueboard",
      },
      min_role: 100,
      //default_render_page: "loginpage",
    });

    await getState().setConfig("login_form", "loginform");

    await View.create({
      name: "signupform",
      viewtemplate: "Edit",
      table_id: table.id,
      configuration: {
        fixed: { email: "", preset_email: "" },
        layout: {
          above: [
            {
              widths: [2, 10],
              besides: [
                {
                  above: [
                    null,
                    { type: "blank", contents: "Email", isFormula: {} },
                  ],
                },
                {
                  above: [
                    null,
                    { type: "field", fieldview: "edit", field_name: "email" },
                  ],
                },
              ],
            },
            { type: "line_break" },
            {
              widths: [2, 10],
              besides: [
                { type: "blank", contents: "Username", isFormula: {} },
                { type: "field", fieldview: "edit", field_name: "username" },
              ],
            },
            { type: "line_break" },
            {
              widths: [2, 10],
              besides: [
                {
                  above: [
                    null,
                    { type: "blank", contents: "Password", isFormula: {} },
                  ],
                },
                {
                  above: [
                    {
                      type: "field",
                      fieldview: "password",
                      field_name: "password",
                    },
                    null,
                  ],
                },
              ],
            },
            { type: "line_break" },
            {
              type: "action",
              rndid: "63f01b",
              minRole: 100,
              isFormula: {},
              action_name: "Sign up",
              action_style: "btn-primary",
              configuration: {},
            },
          ],
        },
        columns: [
          { type: "Field", fieldview: "edit", field_name: "email" },
          { type: "Field", fieldview: "edit", field_name: "username" },
          { type: "Field", fieldview: "password", field_name: "password" },
          {
            type: "Action",
            rndid: "63f01b",
            minRole: 100,
            isFormula: {},
            action_name: "Sign up",
            action_style: "btn-primary",
            configuration: {},
          },
        ],
        viewname: "loginform",
        view_when_done: "publicissueboard",
      },
      min_role: 100,
      //default_render_page: "signuppage",
    });
    await getState().setConfig("signup_form", "signupform");

    await getState().setConfig("new_user_form", "");
  });
  it("should show sign up page", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/auth/signup/").expect(toInclude("Username"));
  });
  it("should sign up", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/auth/signup/")
      .send("email=staff7@foo.com")
      .send("username=bestStaffEver")
      .send("password=seCERGERG45et")
      .expect(toRedirect("/"));
    const user = await User.findOne({ username: "bestStaffEver" });
    expect(!!user).toBe(true);
    expect(user.email).toBe("staff7@foo.com");
    expect(!user.height).toBe(true);
    expect(user.checkPassword("seCERGERG45et")).toBe(true);
  });
  it("should show login page", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/auth/login/")
      .expect(toInclude("Username"))
      .expect(toNotInclude("E-mail"));
  });
  it("should log in with new user", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/auth/login/")
      .send("username=bestStaffEver")
      .send("password=seCERGERG45et")
      .expect(toRedirect("/"));
  });

  it("should sign up with new user form", async () => {
    await getState().setConfig("new_user_form", "newuser");

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/auth/signup/")
      .send("email=staff8@foo.com")
      .send("username=staffOfTheMonth")
      .send("password=seCERRG45et")
      .expect(200)
      .expect(toInclude("Height"))
      .expect(toInclude("/auth/signup_final"))
      .expect(toInclude("staff8@foo.com"))
      .expect(toInclude("staffOfTheMonth"))
      .expect(toInclude("seCERRG45et"));
    await request(app)
      .post("/auth/signup_final/")
      .send("email=staff8@foo.com")
      .send("username=staffOfTheMonth")
      .send("password=seCERRG45et")
      .send("height=15")
      .expect(toRedirect("/"));

    const table = Table.findOne({ name: "users" });
    const user = await User.findOne({ email: "staff8@foo.com" });
    expect(!!user).toBe(true);
    expect(user.checkPassword("seCERRG45et")).toBe(true);
    const userrow = await table.getRow({ email: "staff8@foo.com" });
    expect(userrow.username).toBe("staffOfTheMonth");
    expect(userrow.height).toBe(15);
  });
});

describe("AuthTest Locale files", () => {
  it("should be valid JSON", async () => {
    const localeFiles = await fs.promises.readdir(
      path.join(__dirname, "..", "/locales")
    );
    expect(localeFiles.length).toBeGreaterThan(3);
    expect(localeFiles).toContain("en.json");
    for (const fnm of localeFiles) {
      const conts = await fs.promises.readFile(
        path.join(__dirname, "..", "/locales", fnm)
      );
      expect(conts.length).toBeGreaterThan(1);

      const j = JSON.parse(conts);
      expect(Object.keys(j).length).toBeGreaterThan(1);
    }
  });
});

describe("AuthTest Allowed login methods", () => {
  it("can login with password", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/auth/login/")
      .send("email=staff@foo.com")
      .send("password=ghrarhr54hg")
      .expect(toRedirect("/"));
  });
  it("can disable password login", async () => {
    const adminLoginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/roleadmin/setrole_allowed_auth_methods/40")
      .set("Cookie", adminLoginCookie)
      .send({
        enabled: false,
        method: "Password",
      })
      .expect(succeedJsonWith(() => true));
  });
  it("cannot login with password", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/auth/login/")
      .send("email=staff@foo.com")
      .send("password=ghrarhr54hg")
      .expect(toRedirect("/auth/login"));
  });
});

describe("JWT login rate limiting", () => {
  it("should rate-limit GET /auth/login-with/jwt after repeated failed attempts", async () => {
    const app = await getApp({ disableCsrf: true });
    // Send many failed login attempts via the JWT endpoint
    // The normal POST /auth/login is rate-limited to 3 attempts per 5 minutes per user,
    // but GET /auth/login-with/jwt bypasses this rate limiting entirely.
    // This test asserts that the JWT endpoint is also rate-limited.
    let rateLimited = false;
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .get("/auth/login-with/jwt")
        .query({ email: "user@foo.com", password: `wrongpassword${i}` });

      if (res.statusCode === 429 || res.headers["x-ratelimit-redirect"]) {
        rateLimited = true;
        break;
      }
    }
    expect(rateLimited).toBe(true);
  });

  it("should rate-limit POST /auth/login-with/jwt after repeated failed attempts", async () => {
    const app = await getApp({ disableCsrf: true });
    const headers = {
      "X-Requested-With": "XMLHttpRequest",
      "X-Saltcorn-Client": "mobile-app",
    };
    let rateLimited = false;
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post("/auth/login-with/jwt")
        .set(headers)
        .send({ email: "user@foo.com", password: `wrongpassword${i}` });
        
      if (res.statusCode === 429 || res.headers["x-ratelimit-redirect"]) {
        rateLimited = true;
        break;
      }
    }
    expect(rateLimited).toBe(true);
  });
});

describe("JWT login disabled user bypass", () => {
  let testUserEmail = "disabled-jwt-test@foo.com";
  let testUserPassword = "TestPassword123!";

  beforeAll(async () => {
    // Create a test user and then disable them
    const existingUser = await User.findOne({ email: testUserEmail });
    if (existingUser) {
      await existingUser.update({ disabled: false });
      await existingUser.delete();
    }
    const u = await User.create({
      email: testUserEmail,
      password: testUserPassword,
      role_id: 80,
    });
    // Disable the user
    await u.update({ disabled: true });
  });

  afterAll(async () => {
    // Clean up
    const u = await User.findOne({ email: testUserEmail });
    if (u) {
      await u.update({ disabled: false });
      await u.delete();
    }
  });

  it("should reject disabled user on normal login", async () => {
    const app = await getApp({ disableCsrf: true });
    // Normal login should fail for disabled user - redirects back to login
    await request(app)
      .post("/auth/login/")
      .send(`email=${testUserEmail}`)
      .send(`password=${testUserPassword}`)
      .expect(toRedirect("/auth/login"));
  });

  it("should reject disabled user on JWT login", async () => {
    const app = await getApp({ disableCsrf: true });
    const headers = {
      "X-Requested-With": "XMLHttpRequest",
      "X-Saltcorn-Client": "mobile-app",
    };
    const res = await request(app)
      .post("/auth/login-with/jwt")
      .set(headers)
      .send({ email: testUserEmail, password: testUserPassword });

    // A disabled user should NOT receive a valid JWT token.
    // The response should contain an error, not a token string.
    const body = res.body;
    const isToken = typeof body === "string" && body.includes(".");
    expect(isToken).toBe(false);
  });
});

describe("API token disabled user bypass", () => {
  let testUserEmail = "disabled-apitoken-test@foo.com";
  let testUserPassword = "TestPassword456!";
  let apiToken;

  beforeAll(async () => {
    // Clean up any leftover user from a previous run
    const existingUser = await User.findOne({ email: testUserEmail });
    if (existingUser) {
      await existingUser.update({ disabled: false });
      await existingUser.delete();
    }
    // Create a user, generate an API token, then disable them
    const u = await User.create({
      email: testUserEmail,
      password: testUserPassword,
      role_id: 80,
    });
    apiToken = await u.getNewAPIToken();
  });

  afterAll(async () => {
    const u = await User.findOne({ email: testUserEmail });
    if (u) {
      await u.update({ disabled: false });
      await u.delete();
    }
  });

  it("should allow API token access to rooms for enabled user", async () => {
    const app = await getApp({ disableCsrf: true });
    // rooms table has min_role_read=80 (user role) - our user (role 80) can read it
    const res = await request(app)
      .get("/api/rooms/")
      .set("Authorization", "Bearer " + apiToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBeTruthy();
  });

  it("should reject API token access for disabled user", async () => {
    // Disable the user
    const u = await User.findOne({ email: testUserEmail });
    await u.update({ disabled: true });

    const app = await getApp({ disableCsrf: true });
    // rooms table has min_role_read=80 (user). Our disabled user has role 80,
    // so their token would grant access if the disabled check is missing.
    // Public users (role 100) cannot read rooms.
    // A disabled user's API token should NOT grant authenticated access.
    const res = await request(app)
      .get("/api/rooms/")
      .set("Authorization", "Bearer " + apiToken);
    const body = res.body;
    // Should NOT succeed - a disabled user should not have user-level access
    expect(body.success).toBeFalsy();
  });
});

describe("TOTP brute force protection", () => {
  let testUserEmail = "totp-bruteforce-test@foo.com";
  let testUserPassword = "TotpBrute789!";
  let totpKey = "abcdefghij";

  beforeAll(async () => {
    // Create a user with TOTP enabled
    const existingUser = await User.findOne({ email: testUserEmail });
    if (existingUser) {
      await existingUser.update({ disabled: false });
      await existingUser.delete();
    }
    const u = await User.create({
      email: testUserEmail,
      password: testUserPassword,
      role_id: 80,
    });
    // Enable TOTP with a known key
    u._attributes.totp_enabled = true;
    u._attributes.totp_key = totpKey;
    await u.update({ _attributes: u._attributes });
  });

  afterAll(async () => {
    const u = await User.findOne({ email: testUserEmail });
    if (u) {
      u._attributes.totp_enabled = false;
      delete u._attributes.totp_key;
      await u.update({ _attributes: u._attributes, disabled: false });
      await u.delete();
    }
  });

  it("should rate-limit TOTP login attempts after repeated failures", async () => {
    const app = await getApp({ disableCsrf: true });

    // Step 1: Login with correct password to get session with pending_user
    const loginRes = await request(app)
      .post("/auth/login/")
      .send(`email=${testUserEmail}`)
      .send(`password=${testUserPassword}`);
    expect(loginRes.headers["location"]).toBe("/auth/twofa/login/totp");

    const sessionCookie = resToLoginCookie(loginRes);

    // Step 2: Send many wrong TOTP codes.
    // The POST /auth/login endpoint is rate-limited (ipLimiter + userLimiter),
    // but POST /auth/twofa/login/totp has NO rate limiting at all.
    // This allows an attacker who knows the password to brute-force the 6-digit
    // TOTP code (1,000,000 possibilities) without any throttling.
    // The TOTP endpoint should have rate limiting just like the login endpoint.
    let rateLimited = false;
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post("/auth/twofa/login/totp")
        .set("Cookie", sessionCookie)
        .send(`code=${100000 + i}`);

      if (res.statusCode === 429 || res.headers["x-ratelimit-redirect"]) {
        rateLimited = true;
        break;
      }
    }

    // This SHOULD be rate-limited to prevent TOTP brute-force attacks.
    // Currently fails because the endpoint has no rate limiting.
    expect(rateLimited).toBe(true);
  });
});
