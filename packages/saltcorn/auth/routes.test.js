const request = require("supertest");
const getApp = require("../app");
const Table = require("saltcorn-data/models/table");
const User = require("saltcorn-data/models/user");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  toRedirect,
  toInclude,
  toSucceed
} = require("../auth/testhelp");
const db = require("saltcorn-data/db");

afterAll(db.close);

describe("Public auth Endpoints", () => {
  it("should show login", async done => {
    const app = await getApp();
    await request(app)
      .get("/auth/login/")
      .expect(toSucceed());
    done();
  });

  it("should show signup", async done => {
    const app = await getApp();
    await request(app)
      .get("/auth/signup/")
      .expect(toSucceed());
    done();
  });

  it("should allow logout for unauth user", async done => {
    const app = await getApp();
    await request(app).get("/auth/logout/");
    expect(toRedirect("/"));
    done();
  });
});

describe("login process", () => {
  it("should say Login when not logged in", async done => {
    const app = await getApp();
    await request(app).get("/");
    expect(toInclude("Login"));
    done();
  });

  it("should say Logout when logged in", async done => {
    const app = await getApp();
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/")
      .set("Cookie", loginCookie);

    expect(toInclude("Logout"));
    done();
  });
});

describe("signup process", () => {
  it("should sign up", async done => {
    const app = await getApp();
    await request(app)
      .post("/auth/signup/")
      .send("email=staff1@foo.com")
      .send("password=secret")
      .expect(toRedirect("/"));
    done();
  });
});

describe("user admin", () => {
  it("should list tables", async done => {
    const app = await getApp();
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/useradmin/")
      .set("Cookie", loginCookie)
      .expect(toSucceed())
      .expect(toInclude("staff@foo.com"));
    done();
  });
  it("shows new user form", async done => {
    const app = await getApp();
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/useradmin/new")
      .set("Cookie", loginCookie)
      .expect(toSucceed());
    done();
  });
  it("creates new user", async done => {
    const app = await getApp();
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/useradmin/save")
      .send("email=staff2@foo.com")
      .send("password=fidelio")
      .send("role_id=3")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/useradmin"));
    done();
  });

  it("can login with new user", async done => {
    const app = await getApp();
    await request(app)
      .post("/auth/login/")
      .send("email=staff2@foo.com")
      .send("password=fidelio")
      .expect(toRedirect("/"));
    done();
  });

  it("shows edit user form", async done => {
    const app = await getApp();
    const loginCookie = await getAdminLoginCookie();
    const user = await User.findOne({ email: "staff2@foo.com" });
    expect(user.role_id).toBe(3);
    await request(app)
      .get(`/useradmin/${user.id}`)
      .set("Cookie", loginCookie)
      .expect(toSucceed());
    done();
  });

  it("edits user", async done => {
    const app = await getApp();
    const loginCookie = await getAdminLoginCookie();
    const user = await User.findOne({ email: "staff2@foo.com" });
    await request(app)
      .post("/useradmin/save")
      .send("email=staff2@foo.com")
      .send(`id=${user.id}`)
      .send("role_id=2")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/useradmin"));
    const edituser = await User.findOne({ email: "staff2@foo.com" });
    expect(edituser.role_id).toBe(2);

    done();
  });
  it("deletes user", async done => {
    const app = await getApp();
    const loginCookie = await getAdminLoginCookie();
    const user = await User.findOne({ email: "staff2@foo.com" });
    await request(app)
      .post(`/useradmin/delete/${user.id}`)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/useradmin"));
    const delusers = await User.find({ email: "staff2@foo.com" });
    expect(delusers.length).toBe(0);

    done();
  });
});
