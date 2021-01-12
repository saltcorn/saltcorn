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
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const { get_reset_link, generate_email } = require("../auth/resetpw");
const i18n = require("i18n");
const path = require("path");

afterAll(db.close);
beforeAll(async () => {
  await resetToFixtures();
});

describe("Public auth Endpoints", () => {
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

describe("login process", () => {
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

describe("user settings", () => {
  it("should show user settings", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/auth/settings")
      .set("Cookie", loginCookie)
      .expect(toInclude(">staff@foo.com<"));
  });
  it("should change password", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
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
  });
});

describe("signup process", () => {
  it("should sign up", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/auth/signup/")
      .send("email=staff1@foo.com")
      .send("password=seCERGERG45et")
      .expect(toRedirect("/"));
  });
});

describe("forgot password", () => {
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

    const link = await get_reset_link(u, {});

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

describe("user admin", () => {
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
      .send("role_id=8")
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
    expect(user.role_id).toBe(8);
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
      .send("role_id=4")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/useradmin"));
    const edituser = await User.findOne({ email: "staff2@foo.com" });
    expect(edituser.role_id).toBe(4);
  });
  it("tries to create new user with existing email", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/useradmin/save")
      .send("email=staff2@foo.com")
      .send("password=fideRGE54lio")
      .send("role_id=8")
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
});
describe("User fields", () => {
  it("should add fields", async () => {
    const table = await Table.findOne({ name: "users" });
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
          { type: "Action", minRole: 10, action_name: "Save" },
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
            { type: "action", minRole: 10, action_name: "Save" },
          ],
        },
      },
      min_role: 1,
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
    const table = await Table.findOne({ name: "users" });
    const ut = await table.getRow({ email: "staff14@foo.com" });
    expect(ut.email).toBe("staff14@foo.com");
    expect(ut.height).toBe(191);
  });
});

describe("signup with custom login form", () => {
  it("should create user fields and login form", async () => {
    const table = await Table.findOne({ name: "users" });
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
              minRole: 10,
              isFormula: {},
              action_name: "Login",
              action_label: "Login",
              action_style: "btn-primary",
              configuration: {},
            },
            {
              type: "action",
              rndid: "45dd57",
              minRole: 10,
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
            minRole: 10,
            isFormula: {},
            action_name: "Login",
            action_label: "Login",
            action_style: "btn-primary",
            configuration: {},
          },
          {
            type: "Action",
            rndid: "45dd57",
            minRole: 10,
            isFormula: {},
            action_name: "Login with github",
            configuration: {},
          },
        ],
        viewname: "loginform",
        view_when_done: "publicissueboard",
      },
      min_role: 1,
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
              minRole: 10,
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
            minRole: 10,
            isFormula: {},
            action_name: "Sign up",
            action_style: "btn-primary",
            configuration: {},
          },
        ],
        viewname: "loginform",
        view_when_done: "publicissueboard",
      },
      min_role: 1,
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
    const res = await request(app)
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
      .send("password=seCERGERG45et")
      .expect(200)
      .expect(toInclude("Height"));
  });
});
/* missing tests:

* login and signup forms
* login and signup on pages
* login and signup views with new user form
*/
