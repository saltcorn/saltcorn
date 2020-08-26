const request = require("supertest");
const getApp = require("../app");
const Table = require("@saltcorn/data/models/table");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  toRedirect,
  resetToFixtures
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");

afterAll(db.close);
beforeAll(async () => {
  await resetToFixtures();
});
describe("Table Endpoints", () => {
  it("should create tables", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/table/new")
      .set("Cookie", loginCookie)
      .expect(toInclude("Table name"));
    await request(app)
      .post("/table/")
      .send("name=mypostedtable")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/table/4"));
    await request(app)
      .get("/table/4")
      .set("Cookie", loginCookie)
      .expect(toInclude("mypostedtable"));
    //expect(res.statusCode).toEqual(302);
  });
  it("should reject existing tables", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/table/")
      .send("name=mypostedtable")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/table/new"));
  });
  it("should reject blank name", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/table/")
      .send("name=")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/table/new"));
  });
  itShouldRedirectUnauthToLogin("/table/");

  it("should list tables", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/table/")
      .set("Cookie", loginCookie)
      .expect(toInclude("mypostedtable"))
      .expect(toInclude("books"));
  });

  it("should edit tables", async () => {
    const loginCookie = await getAdminLoginCookie();

    const tbl = await Table.findOne({ name: "mypostedtable" });

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get(`/table/${tbl.id}`)
      .set("Cookie", loginCookie)
      .expect(toInclude("Add field"))
      .expect(toNotInclude("[object"));

    await request(app)
      .post(`/table`)
      .set("Cookie", loginCookie)
      .send(
        "api_access=Read+only&min_role_read=10&min_role_write=1&id=" + tbl.id
      )
      .expect(toRedirect(`/table/${tbl.id}`));
    await request(app)
      .get(`/table/${tbl.id}`)
      .set("Cookie", loginCookie);
    await request(app)
      .post(`/table`)
      .set("Cookie", loginCookie)
      .send("api_access=No+API&min_role_read=10&min_role_write=1&id=" + tbl.id)
      .expect(toRedirect(`/table/${tbl.id}`));
    await request(app)
      .get(`/table/${tbl.id}`)
      .set("Cookie", loginCookie);
    await request(app)
      .post(`/table`)
      .set("Cookie", loginCookie)
      .send(
        "api_access=Read+and+write&min_role_read=10&min_role_write=1&id=" +
          tbl.id
      )
      .expect(toRedirect(`/table/${tbl.id}`));
    await request(app)
      .get(`/table/${tbl.id}`)
      .set("Cookie", loginCookie);
  });
  it("should download csv ", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/table/download/books")
      .set("Cookie", loginCookie)
      .expect(200);
  });
  it("should show create from csv form", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/table/create-from-csv")
      .set("Cookie", loginCookie)
      .expect(toInclude('type="file"'));
  });
  it("should create from csv", async () => {
    const csv = `item,cost,count, vatable
Book, 5,4, f
Pencil, 0.5,2, t`;
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/table/create-from-csv")
      .set("Cookie", loginCookie)
      .field('name','expenses')
      .attach('file', Buffer.from(csv, 'utf-8'))
      .expect(toRedirect("/table/5"));
  });
  it("should delete tables", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
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
  it("should delete tables", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    const tbl = await Table.findOne({ name: "books" });
    await request(app)
      .post(`/table/delete/${tbl.id}`)
      .set("Cookie", loginCookie)
      .expect(302);
    if (!db.isSQLite)
      await request(app)
        .get("/table/")
        .set("Cookie", loginCookie)
        .expect(toInclude("alert-danger"))
        .expect(toInclude("books"));
  });
});
