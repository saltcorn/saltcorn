const request = require("supertest");
const app = require("../app");
const Table = require("../models/table");
const {
  getStaffLoginCookie,
  getAdminLoginCookie
} = require("../auth/testhelp");

describe("Public auth Endpoints", () => {
  it("should show login", async done => {
    const res = await request(app).get("/auth/login/");
    expect(res.statusCode).toEqual(200);
    done();
  });

  it("should show signup", async done => {
    const res = await request(app).get("/auth/signup/");
    expect(res.statusCode).toEqual(200);
    done();
  });

  it("should allow logout for unauth user", async done => {
    const res = await request(app).get("/auth/logout/");
    expect(res.statusCode).toEqual(302);
    done();
  });
});

describe("login process", () => {
  it("should say Login when not logged in", async done => {
    const res = await request(app).get("/");
    expect(res.text.includes("Login")).toBe(true);
    done();
  });

  it("should say Logout when logged in", async done => {
    const loginCookie = await getStaffLoginCookie();
    const res = await request(app)
      .get("/")
      .set("Cookie", loginCookie);

    expect(res.text.includes("Logout")).toBe(true);
    done();
  });
});

describe("signup process", () => {
  it("should sign up", async done => {
    const res = await request(app)
      .post("/auth/signup/")
      .send("email=staff1@foo.com")
      .send("password=secret")
      .expect("Location", "/")
      .expect(302);
    done();
  });
});
