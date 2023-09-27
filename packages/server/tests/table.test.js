const request = require("supertest");
const getApp = require("../app");
const Table = require("@saltcorn/data/models/table");
const Field = require("@saltcorn/data/models/field");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  getUserLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  toRedirect,
  resetToFixtures,
  succeedJsonWith,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const User = require("@saltcorn/data/models/user");
const { plugin_with_routes } = require("@saltcorn/data/tests/mocks");
const { getState } = require("@saltcorn/data/db/state");

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
      .expect(toRedirect("/table/16"));
    await request(app)
      .get("/table/10")
      .set("Cookie", loginCookie)
      .expect(toInclude("mypostedtable"));
    await request(app)
      .get("/table/patients")
      .set("Cookie", loginCookie)
      .expect(toInclude("favbook"))
      .expect(toInclude('href="/table/books"'));
    await request(app)
      .get("/table/books")
      .set("Cookie", loginCookie)
      .expect(toInclude("patients"));
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

    const tbl = Table.findOne({ name: "mypostedtable" });

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get(`/table/${tbl.id}`)
      .set("Cookie", loginCookie)
      .expect(toInclude("Add field"))
      .expect(toNotInclude("[object"));

    await request(app)
      .post(`/table`)
      .set("Cookie", loginCookie)
      .send("min_role_read=100&min_role_write=1&id=" + tbl.id)
      .expect(toRedirect(`/table/${tbl.id}`));
    await request(app).get(`/table/${tbl.id}`).set("Cookie", loginCookie);
    await request(app)
      .post(`/table`)
      .set("Cookie", loginCookie)
      .send("min_role_read=100&min_role_write=1&id=" + tbl.id)
      .expect(toRedirect(`/table/${tbl.id}`));
    await request(app).get(`/table/${tbl.id}`).set("Cookie", loginCookie);
    await request(app)
      .post(`/table`)
      .set("Cookie", loginCookie)
      .send("min_role_read=100&min_role_write=1&id=" + tbl.id)
      .expect(toRedirect(`/table/${tbl.id}`));
    await request(app).get(`/table/${tbl.id}`).set("Cookie", loginCookie);
  });
  it("should edit external table role", async () => {
    const loginCookie = await getAdminLoginCookie();
    getState().registerPlugin("mock_plugin", plugin_with_routes());
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post(`/table`)
      .set("Cookie", loginCookie)
      .send("min_role_read=80&name=exttab&external=on")
      .expect(toRedirect(`/table/exttab`));
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
      .expect(toRedirect("/table/17"));
  });
  it("should upload csv to existing table", async () => {
    const csv = `author,Pages
Joe Celko, 856
Gordon Kane, 218`;
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    let filename;
    await request(app)
      .post("/table/upload_to_table/books")
      .set("Cookie", loginCookie)
      .attach("file", Buffer.from(csv, "utf-8"))
      .expect(toInclude(">Preview<"))
      .expect(toInclude("Proceed"))
      .expect((res) => {
        filename = res.text.match(
          /data-csv-filename\=\"([A-Za-z0-9 _\-]*)\"/
        )[1];
      });

    await request(app)
      .post(`/table/finish_upload_to_table/books/${filename}`)
      .set("Cookie", loginCookie)
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
    const tbl = Table.findOne({ name: "mypostedtable" });
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
    const tbl = Table.findOne({ name: "books" });
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
      .get("/table/add-constraint/" + id + "/Unique")
      .set("Cookie", loginCookie)
      .expect(toInclude("Add constraint to books"));
    await request(app)
      .post("/table/add-constraint/" + id + "/Unique")
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
  it("should show relationship diagram", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/table/relationship-diagram")
      .set("Cookie", loginCookie)
      .expect(toInclude("Relationship diagram"));
  });
  it("should delete tables", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    const tbl = Table.findOne({ name: "books" });
    await request(app)
      .post(`/table/delete/${tbl.id}`)
      .set("Cookie", loginCookie)
      .expect(302);
    if (!db.isSQLite)
      await request(app)
        .get("/table/")
        .set("Cookie", loginCookie)
        .expect(
          toInclude(
            "cannot drop table books because other objects depend on it"
          )
        );
  });
});
describe("deletion to table with row ownership", () => {
  it("should create table", async () => {
    const persons = await Table.create("owned");
    await Field.create({
      table: persons,
      name: "name",
      type: "String",
    });
    const ownerfield = await Field.create({
      table: persons,
      name: "owner",
      type: "Key to users",
    });
    await persons.update({
      ownership_field_id: ownerfield.id,
      min_role_write: 1,
    });
    const user = await User.findOne({ email: "staff@foo.com" });
    const otheruser = await User.findOne({ email: "user@foo.com" });
    const row = await persons.insertRow({ name: "something", owner: user.id });
    expect(await persons.countRows()).toBe(1);
    const loginCookie = await getStaffLoginCookie();
    const uloginCookie = await getUserLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/api/owned").expect(401);
    await request(app)
      .get("/api/owned")
      .set("Cookie", loginCookie)
      .expect(
        succeedJsonWith(
          (rows) => rows.length == 1 && rows[0].name === "something"
        )
      );
    await request(app)
      .get("/api/owned")
      .set("Cookie", uloginCookie)
      .expect(succeedJsonWith((rows) => rows.length == 0));

    await request(app)
      .post("/delete/owned/" + row)
      .expect(toRedirect("/list/owned"));
    expect(await persons.countRows()).toBe(1);
    await request(app)
      .post("/delete/owned/" + row)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/list/owned"));
    expect(await persons.countRows()).toBe(0);
    await persons.insertRow({ name: "someother", owner: user.id });
    await persons.insertRow({ name: "somethung" });
    const loginCookie1 = await getAdminLoginCookie();

    expect(await persons.countRows()).toBe(2);
    await request(app)
      .post("/table/delete-all-rows/owned")
      .set("Cookie", loginCookie1)
      .expect(toRedirect("/table/" + persons.id));
    expect(await persons.countRows()).toBe(0);
  });
});
