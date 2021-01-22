const request = require("supertest");
const getApp = require("../app");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  toRedirect,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  succeedJsonWith,
  resetToFixtures,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const User = require("@saltcorn/data/models/user");
const reset = require("@saltcorn/data/db/reset_schema");

beforeAll(async () => {
  await resetToFixtures();
});
afterAll(db.close);

describe("standard edit form", () => {
  itShouldRedirectUnauthToLogin("/list/books");
  it("show list", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/list/books")
      .set("Cookie", loginCookie)
      .expect(toInclude("books data table"));
  });

  it("should delete", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/delete/books/3")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/list/books"));
  });
});

describe("homepage", () => {
  it("shows to admin", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/")
      .set("Cookie", loginCookie)
      .expect(toInclude("authorlist"));
  });
  it("shows redirect to admin", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/pageedit/set_root_page")
      .send("public=/view/authorlist")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/pageedit"));

    await request(app).get("/").expect(toRedirect("/view/authorlist"));

    await request(app)
      .post("/pageedit/set_root_page")
      .send("public=a_page")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/pageedit"));
    await request(app).get("/").expect(toInclude("Hello world"));
    await request(app)
      .post("/pageedit/set_root_page")
      .send("public=")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/pageedit"));
  });
  it("resets", async () => {
    await reset();
  });
  it("redirects to create first user", async () => {
    const app = await getApp({ disableCsrf: true });

    await request(app).get("/").expect(toRedirect("/auth/create_first_user"));
    await request(app)
      .post("/auth/create_first_user")
      .send("email=admin@foo.com")
      .send("password=AhGGr6rhu45")
      .expect(toRedirect("/"));
  });
  it("shows empty quick start", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/")
      .set("Cookie", loginCookie)
      .expect(toInclude("Quick Start"))
      .expect(toInclude("Four different ways to get started"));
  });
  it("shows no-view quick start", async () => {
    await Table.create("mytable");
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/")
      .set("Cookie", loginCookie)
      .expect(toInclude("Quick Start"))
      .expect(toInclude("You have no views!"));
  });
  it("shows with-view quick start", async () => {
    const table = await Table.findOne({ name: "mytable" });

    const v = await View.create({
      table_id: table.id,
      name: "anewview",
      viewtemplate: "List",
      configuration: { columns: [], default_state: { foo: "bar" } },
      min_role: 10,
    });
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/")
      .set("Cookie", loginCookie)
      .expect(toInclude("Quick Start"))
      .expect(toNotInclude("You have no views!"));
  });
  it("resets", async () => {
    await resetToFixtures();
  });
});

describe("bool toggle", () => {
  it("should toggle", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post(`/edit/toggle/readings/1/normalised`)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/list/readings"));
  });
});

describe("history", () => {
  it("should enable history", async () => {
    const table = await Table.findOne({ name: "books" });

    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post(`/table`)
      .set("Cookie", loginCookie)
      .send("id=" + table.id)
      .send("versioned=on")
      .expect(toRedirect("/table/" + table.id));
    const table1 = await Table.findOne({ name: "books" });
    expect(table1.versioned).toBe(true);
  });
  it("create new row in versioned table", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/books/")
      .set("Cookie", loginCookie)
      .send({
        author: "Caesar",
        pages: 178,
      })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(succeedJsonWith((resp) => resp && typeof resp === "number"));
  });
  it("edit row in versioned table", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    const table = await Table.findOne({ name: "books" });
    const tolstoy = await table.getRow({ author: "Leo Tolstoy" });
    await request(app)
      .post("/api/books/" + tolstoy.id)
      .set("Cookie", loginCookie)
      .send({
        author: "Leo Tolstoy",
        pages: 729,
      })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(succeedJsonWith((resp) => resp === true));
  });
  it("edit row in versioned table again", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    const table = await Table.findOne({ name: "books" });
    const tolstoy = await table.getRow({ author: "Leo Tolstoy" });
    await request(app)
      .post("/api/books/" + tolstoy.id)
      .set("Cookie", loginCookie)
      .send({
        author: "Leo Tolstoy",
        pages: 730,
      })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(succeedJsonWith((resp) => resp === true));
  });

  it("show versions", async () => {
    const loginCookie = await getAdminLoginCookie();
    const table = await Table.findOne({ name: "books" });
    const tolstoy = await table.getRow({ author: "Leo Tolstoy" });
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/list/_versions/books/" + tolstoy.id)
      .set("Cookie", loginCookie)
      .expect(toInclude("729"))
      .expect(toInclude("730"))
      .expect(toNotInclude("728"))
      .expect(toInclude("Leo Tolstoy"));
  });
  it("restores old version", async () => {
    const loginCookie = await getAdminLoginCookie();
    const table = await Table.findOne({ name: "books" });
    const tolstoy = await table.getRow({ author: "Leo Tolstoy" });
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post(`/list/_restore/books/${tolstoy.id}/1`)
      .set("Cookie", loginCookie);
  });
  it("show list with restored version", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/books")
      .set("Cookie", loginCookie)
      .expect(toInclude("729"))
      .expect(toNotInclude("730"));
  });
});
