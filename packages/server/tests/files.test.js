const request = require("supertest");
const getApp = require("../app");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  toRedirect,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toSucceed,
  toNotInclude,
  resetToFixtures,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const fs = require("fs").promises;
const File = require("@saltcorn/data/models/file");
const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const { table } = require("console");

beforeAll(async () => {
  await resetToFixtures();
  const mv = async (fnm) => {
    await fs.writeFile(fnm, "nevergonnagiveyouup");
  };
  await File.from_req_files(
    { mimetype: "image/png", name: "rick.png", mv, size: 245752 },
    1,
    4
  );
});
afterAll(db.close);

describe("files admin", () => {
  itShouldRedirectUnauthToLogin("/files");
  it("show files list", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/files")
      .set("Cookie", loginCookie)
      .expect(toInclude("Size (KiB)"));
  });
  it("download file", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/files/download/2")
      .set("Cookie", loginCookie)
      .expect(toSucceed());
  });

  it("serve file", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/files/serve/2")
      .set("Cookie", loginCookie)
      .expect(toSucceed());
  });
  it("not serve file to public", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/files/serve/2").expect(toRedirect("/"));
  });
  it("set file min role", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/files/setrole/2")
      .set("Cookie", loginCookie)
      .send("role=10")
      .expect(toRedirect("/files"));
  });
  it("serve file to public after role change", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/files/serve/2").expect(toSucceed());
  });
  it("delete file", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/files/delete/2")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/files"));
  });
});
describe("files edit", () => {
  it("creates table and view", async () => {
    const table = await Table.create("thefiletable");
    await Field.create({
      table,
      name: "first_name",
      label: "First name",
      type: "String",
    });
    await Field.create({
      table,
      name: "mugshot",
      label: "Mugshot",
      type: "File",
    });
    await View.create({
      table_id: table.id,
      name: "thefileview",
      viewtemplate: "Edit",
      configuration: {
        columns: [
          { type: "Field", field_name: "mugshot", fieldview: "upload" },
          { type: "Field", field_name: "first_name", fieldview: "edit" },
          { type: "Action", action_name: "Save", minRole: 10 },
        ],
        layout: {
          above: [
            {
              type: "field",
              field_name: "mugshot",
              fieldview: "upload",
            },
            {
              type: "field",
              field_name: "first_name",
              fieldview: "edit",
            },
          ],
        },
      },
      min_role: 10,
      on_root_page: false,
    });
  });
  it("shows edit view", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/view/thefileview")
      .set("Cookie", loginCookie)
      .expect(toSucceed());
  });
  it("shows edit view", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/view/thefileview")
      .set("Cookie", loginCookie)
      .expect(toSucceed());
  });
  it("submits edit view", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .post("/view/thefileview")
      .set("Cookie", loginCookie)
      .field("first_name", "elvis")
      .attach("mugshot", Buffer.from("iamelvis", "utf-8"))
      .expect(toRedirect("/"));
  });
  it("has file", async () => {
    const table = await Table.findOne({ name: "thefiletable" });
    const row = await table.getRow({ first_name: "elvis" });
    const file = await File.findOne({ id: row.mugshot });
    expect(!!file).toBe(true);
  });
});
