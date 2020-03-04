const request = require("supertest");
const app = require("../app");
const Table = require("../db/table");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin
} = require("../auth/testhelp");

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

  itShouldRedirectUnauthToLogin("/table/");

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
