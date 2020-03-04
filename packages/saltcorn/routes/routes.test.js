const request = require("supertest");
const app = require("../app");
const Table = require("../db/table");
const cookie = require("cookie");

const getStaffLoginCookie = async () => {
  const res = await request(app)
    .post("/auth/login/")
    .send("email=staff@foo.com")
    .send("password=secret");

  return res.headers["set-cookie"][0];
};

const getAdminLoginCookie = async () => {
  const res = await request(app)
    .post("/auth/login/")
    .send("email=admin@foo.com")
    .send("password=secret");

  return res.headers["set-cookie"][0];
};

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
describe("list endpoint", () => {
  it("should not allow unauth to list", async done => {
    const res = await request(app).get("/table/authorlist");

    expect(res.statusCode).toEqual(302);
    done();
  });
});
describe("Table Endpoints", () => {
  it("should create tables", async done => {
    const loginCookie = await getAdminLoginCookie();

    const res = await request(app)
      .post("/table/")
      .send("name=mypostedtable")
      .set("Cookie", loginCookie);

    expect(res.statusCode).toEqual(302);
    done();
  });

  it("should list tables", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .get("/table/")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);

    expect(res.text.includes("mypostedtable")).toBe(true);
    expect(res.text.includes("books")).toBe(true);
    done();
  });

  it("should edit tables", async done => {
    const loginCookie = await getAdminLoginCookie();

    const tbl = await Table.find({ name: "mypostedtable" });

    const res = await request(app)
      .get(`/table/${tbl.id}`)
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);
    expect(res.text.includes("<table")).toBe(true);
    expect(res.text.includes("Add field")).toBe(true);
    done();
  });

  it("should delete tables", async done => {
    const loginCookie = await getAdminLoginCookie();

    const tbl = await Table.find({ name: "mypostedtable" });
    const delres = await request(app)
      .post(`/table/delete/${tbl.id}`)
      .set("Cookie", loginCookie);
    expect(delres.statusCode).toEqual(302);

    const res = await request(app)
      .get("/table/")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);
    expect(res.text.includes("mypostedtable")).toBe(false);
    expect(res.text.includes("books")).toBe(true);

    done();
  });
});
