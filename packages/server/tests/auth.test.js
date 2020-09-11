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
    await request(app).get("/auth/logout/");
    expect(toRedirect("/"));
  });
});

describe("login process", () => {
  it("should say Login when not logged in", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/");
    expect(toInclude("Login"));
  });

  it("should say Logout when logged in", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app).get("/").set("Cookie", loginCookie);

    expect(toInclude("Logout"));
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
