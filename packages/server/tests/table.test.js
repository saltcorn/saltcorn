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
  resetToFixtures,
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
      .expect(toRedirect("/table/5"));
    await request(app)
      .get("/table/5")
      .set("Cookie", loginCookie)
      .expect(toInclude("mypostedtable"));
    await request(app)
      .get("/table/patients")
      .set("Cookie", loginCookie)
      .expect(toInclude("favbook"))
      .expect(toInclude('href="/table/books"'));
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
      .send("min_role_read=10&min_role_write=1&id=" + tbl.id)
      .expect(toRedirect(`/table/${tbl.id}`));
    await request(app).get(`/table/${tbl.id}`).set("Cookie", loginCookie);
    await request(app)
      .post(`/table`)
      .set("Cookie", loginCookie)
      .send("min_role_read=10&min_role_write=1&id=" + tbl.id)
      .expect(toRedirect(`/table/${tbl.id}`));
    await request(app).get(`/table/${tbl.id}`).set("Cookie", loginCookie);
    await request(app)
      .post(`/table`)
      .set("Cookie", loginCookie)
      .send("min_role_read=10&min_role_write=1&id=" + tbl.id)
      .expect(toRedirect(`/table/${tbl.id}`));
    await request(app).get(`/table/${tbl.id}`).set("Cookie", loginCookie);
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
      .field("name", "expenses")
      .attach("file", Buffer.from(csv, "utf-8"))
      .expect(toRedirect("/table/6"));
  });
  it("should upload csv to existing table", async () => {
    const csv = `author,Pages
Joe Celko, 856
Gordon Kane, 217`;
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/table/upload_to_table/books")
      .set("Cookie", loginCookie)
      .attach("file", Buffer.from(csv, "utf-8"))
      .expect(toRedirect("/table/2"));
    await request(app)
      .get(`/table/2`)
      .set("Cookie", loginCookie)
      .expect(toInclude("Imported 2 rows"))
      .expect(toInclude("success"));
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
  it("should show constraints", async () => {
    const loginCookie = await getAdminLoginCookie();
    const tbl = await Table.findOne({ name: "books" });
    const id = tbl.id;
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/table/" + id)
      .set("Cookie", loginCookie)
      .expect(toInclude("Constraints"));
    await request(app)
      .get("/table/constraints/" + id)
      .set("Cookie", loginCookie)
      .expect(toInclude("books constraints"));
    await request(app)
      .get("/table/add-constraint/" + id)
      .set("Cookie", loginCookie)
      .expect(toInclude("Add constraint to books"));
    await request(app)
      .post("/table/add-constraint/" + id)
      .send("author=on")
      .send("pages=on")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/table/constraints/" + id));
    await request(app)
      .get("/table/constraints/" + id)
      .set("Cookie", loginCookie)
      .expect(toInclude("Unique"));
    await request(app)
      .post("/table/delete-constraint/1")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/table/constraints/" + id));
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
