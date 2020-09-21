const request = require("supertest");
const getApp = require("../app");
const Table = require("@saltcorn/data/models/table");
const User = require("@saltcorn/data/models/user");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  toRedirect,
  toInclude,
  toSucceed,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const { get_reset_link, generate_email } = require("../auth/resetpw");
const i18n = require("i18n");
const path = require("path");

afterAll(db.close);

describe("Public auth Endpoints", () => {
  it("should show login", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/auth/login/").expect(toSucceed());
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
    await request(app).get("/").expect(toInclude("Login"));
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
      .send("password=secret")
      .send("new_password=foobar")
      .expect(toRedirect("/auth/settings"));
    await request(app)
      .get("/auth/settings")
      .set("Cookie", loginCookie)
      .expect(toInclude("Password changed"));
    const user = await User.findOne({ email: "staff@foo.com" });
    expect(user.checkPassword("foobar")).toBe(true);
    expect(user.checkPassword("secret")).toBe(false);
  });
  it("can login with new password", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/auth/login/")
      .send("email=staff@foo.com")
      .send("password=foobar")
      .expect(toRedirect("/"));
  });
});

describe("signup process", () => {
  it("should sign up", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/auth/signup/")
      .send("email=staff1@foo.com")
      .send("password=secret")
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
      .send("password=bazzzoo")
      .send("token=" + token)
      .expect(toRedirect("/auth/login"));
    await request(app)
      .post("/auth/login/")
      .send("email=staff1@foo.com")
      .send("password=secret")
      .expect(toRedirect("/auth/login"));
    await request(app)
      .post("/auth/login/")
      .send("email=staff1@foo.com")
      .send("password=bazzzoo")
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
      .send("password=fidelio")
      .send("role_id=8")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/useradmin"));
  });

  it("can login with new user", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/auth/login/")
      .send("email=staff2@foo.com")
      .send("password=fidelio")
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
      .send("password=fidelio")
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
