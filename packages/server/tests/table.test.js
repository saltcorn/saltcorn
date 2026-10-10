import { request as request } from "../auth/testhelp.js";
import getApp from "../app.js";
import Table from "@saltcorn/data/models/table";
import Field from "@saltcorn/data/models/field";
import {
  getStaffLoginCookie,
  getAdminLoginCookie,
  getUserLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  toRedirect,
  resetToFixtures,
  succeedJsonWith,
} from "../auth/testhelp.js";
import db from "@saltcorn/data/db";
import User from "@saltcorn/data/models/user";
import { plugin_with_routes } from "@saltcorn/data/tests/mocks";
import { getState } from "@saltcorn/data/db/state";
import { sleep } from "@saltcorn/data/utils";

afterAll(async () => {
  await sleep(200);
  await db.close();
});
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
      .expect(toRedirect("/table/26"));
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
      .expect(toRedirect("/table/27"));
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
        .expect(toInclude("has views. Delete these first"));
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

describe("Table file importers", () => {
  const json_importer_plugin = {
    sc_plugin_api_version: 1,
    importers: {
      JSON: {
        extensions: [".json"],
        async parse(filePath, { limit }) {
          const { readFile } = await import("fs/promises");
          const data = JSON.parse(await readFile(filePath, "utf8"));
          if (!Array.isArray(data))
            return { error: "JSON file must contain an array of objects" };
          return { rows: limit ? data.slice(0, limit) : data };
        },
      },
    },
    exporters: {
      JSON: {
        extension: ".json",
        mimetype: "application/json",
        async export({ rows, columns }) {
          return JSON.stringify({ columns, rows });
        },
      },
    },
  };
  beforeAll(() => {
    getState().registerPlugin("json_importer", json_importer_plugin);
  });
  afterAll(() => {
    delete getState().importers.JSON;
    delete getState().exporters.JSON;
  });
  const filenameRe = /data-csv-filename\=\"([A-Za-z0-9 _\-.]*)\"/;

  it("should accept importer file types on upload", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/table/2")
      .set("Cookie", loginCookie)
      .expect(toInclude("Upload file"))
      .expect(toInclude("text/csv,.csv,.json"));
    await request(app)
      .get("/table/create-from-csv")
      .set("Cookie", loginCookie)
      .expect(toInclude("Create table from file"))
      .expect(toInclude("text/csv,.csv,.json"));
  });
  it("should preview and import a JSON file into existing table", async () => {
    const json = JSON.stringify([
      { author: "Json Author One", pages: 101 },
      { author: "Json Author Two", pages: 102 },
    ]);
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    let filename;
    await request(app)
      .post("/table/upload_to_table/books")
      .set("Cookie", loginCookie)
      .attach("file", Buffer.from(json, "utf-8"), "books.json")
      .expect(toInclude("Import JSON"))
      .expect(toInclude(">Preview<"))
      .expect(toInclude("Found 2 rows for table books"))
      .expect(toInclude("Json Author Two"))
      .expect(toNotInclude("import_method"))
      .expect((res) => {
        filename = res.text.match(filenameRe)[1];
      });
    expect(filename.endsWith(".json")).toBe(true);
    const books = Table.findOne({ name: "books" });
    expect(await books.countRows({ author: "Json Author Two" })).toBe(0);

    await request(app)
      .post(`/table/finish_upload_to_table/books/${filename}`)
      .set("Cookie", loginCookie)
      .expect(toRedirect(`/table/${books.id}`));
    await request(app)
      .get(`/table/${books.id}`)
      .set("Cookie", loginCookie)
      .expect(toInclude("Imported 2 rows"));
    const row = await books.getRow({ author: "Json Author Two" });
    expect(row.pages).toBe(102);
  });
  it("should show importer errors on upload", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    const books = Table.findOne({ name: "books" });
    await request(app)
      .post("/table/upload_to_table/books")
      .set("Cookie", loginCookie)
      .attach("file", Buffer.from("{}", "utf-8"), "bad.json")
      .expect(toRedirect(`/table/${books.id}`));
    await request(app)
      .get(`/table/${books.id}`)
      .set("Cookie", loginCookie)
      .expect(toInclude("JSON file must contain an array of objects"));
  });
  it("should create table from a JSON file", async () => {
    const json = JSON.stringify([
      { item: "Book", cost: 5, vatable: false },
      { item: "Pencil", cost: 0.5, vatable: true },
    ]);
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/table/create-from-csv")
      .set("Cookie", loginCookie)
      .field("name", "jsonexpenses")
      .attach("file", Buffer.from(json, "utf-8"), "expenses.json")
      .expect(302);
    const table = Table.findOne({ name: "jsonexpenses" });
    expect(!!table).toBe(true);
    expect(table.getField("cost").type.name).toBe("Float");
    expect(table.getField("vatable").type.name).toBe("Bool");
    expect(await table.countRows()).toBe(2);
  });
  it("should show download formats menu", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/table/2")
      .set("Cookie", loginCookie)
      .expect(toInclude("downloadMenuButton"))
      .expect(toInclude("/table/download/books?format=CSV"))
      .expect(toInclude("/table/download/books?format=JSON"))
      .expect(toNotInclude("Download CSV"));
  });
  it("should download with exporter", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    const books = Table.findOne({ name: "books" });
    const res = await request(app)
      .get("/table/download/books?format=JSON")
      .set("Cookie", loginCookie)
      .expect(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.headers["content-disposition"]).toBe(
      'attachment; filename="books.json"'
    );
    const body = JSON.parse(res.text);
    expect(body.columns).toContain("author");
    expect(body.rows.length).toBe(await books.countRows());
  });
  it("should still download CSV format", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    const res = await request(app)
      .get("/table/download/books?format=CSV")
      .set("Cookie", loginCookie)
      .expect(200);
    expect(res.headers["content-type"]).toContain("text/csv");
  });
  it("should reject unknown download format", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    const books = Table.findOne({ name: "books" });
    await request(app)
      .get("/table/download/books?format=XLSX")
      .set("Cookie", loginCookie)
      .expect(toRedirect(`/table/${books.id}`));
  });
});
