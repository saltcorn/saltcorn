const request = require("supertest");
const getApp = require("../app");
const Table = require("@saltcorn/data/models/table");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");

afterAll(db.close);

describe("Table Endpoints", () => {
  it("should create tables", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp();
    await request(app)
      .post("/table/")
      .send("name=mypostedtable")
      .set("Cookie", loginCookie);

    //expect(res.statusCode).toEqual(302);
  });

  itShouldRedirectUnauthToLogin("/table/");

  it("should list tables", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp();
    await request(app)
      .get("/table/")
      .set("Cookie", loginCookie)
      .expect(toInclude("mypostedtable"))
      .expect(toInclude("books"));
  });

  it("should edit tables", async () => {
    const loginCookie = await getAdminLoginCookie();

    const tbl = await Table.findOne({ name: "mypostedtable" });

    const app = await getApp();
    await request(app)
      .get(`/table/${tbl.id}`)
      .set("Cookie", loginCookie)
      .expect(toInclude("Add field"))
      .expect(toNotInclude("[object"));
  });

  it("should delete tables", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp();
    const tbl = await Table.findOne({ name: "mypostedtable" });
    const delres = await request(app)
      .post(`/table/delete/${tbl.id}`)
      .set("Cookie", loginCookie);
    expect(delres.statusCode).toEqual(302);

    await request(app)
      .get("/table/")
      .set("Cookie", loginCookie)
      .expect(toNotInclude(`/table/${tbl.id}`))
      .expect(toInclude("books"));
  });
});
