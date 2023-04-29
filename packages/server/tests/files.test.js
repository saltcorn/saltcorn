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
  toSucceedWithImage,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const fs = require("fs").promises;
const path = require("path");
const File = require("@saltcorn/data/models/file");
const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const { table } = require("console");

beforeAll(async () => {
  await resetToFixtures();
  await File.ensure_file_store();
  await File.from_req_files(
    {
      mimetype: "image/png",
      name: "rick.png",
      mv: async (fnm) => {
        await fs.writeFile(fnm, "nevergonnagiveyouup");
      },
      size: 245752,
    },
    1,
    4
  );
  await File.from_req_files(
    {
      mimetype: "image/png",
      name: "large-image.png",
      mv: async (fnm) => {
        await fs.copyFile(path.join(__dirname, "assets/large-image.png"), fnm);
      },
      size: 219422,
    },
    1,
    10
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
      .expect(toInclude("Upload file"));
  });
  it("download file", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/files/download/rick.png")
      .set("Cookie", loginCookie)
      .expect(toSucceed());
  });
  it("serve file by name", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/files/serve/rick.png")
      .set("Cookie", loginCookie)
      .expect(toSucceed());
  });

  it("serve missing file", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/files/serve/missingfile.foo")
      .set("Cookie", loginCookie)
      .expect(404);
  });
  it("not serve file to public", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/files/serve/rick.png").expect(404);
  });
  it("serve public file", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/files/serve/large-image.png")
      .expect(toSucceedWithImage({ lengthIs: (bs) => bs === 219422 }));
  });
  it("serve resized file", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/files/resize/200/100/large-image.png")
      .expect(
        toSucceedWithImage({ lengthIs: (bs) => bs < 100000 && bs > 2000 })
      );
  });
  it("serve resized file without height", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/files/resize/200/0/large-image.png")
      .expect(
        toSucceedWithImage({ lengthIs: (bs) => bs < 100000 && bs > 2000 })
      );
  });
  it("not download file to public", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/files/download/rick.png").expect(404);
  });
  it("set file min role", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/files/setrole/rick.png")
      .set("Cookie", loginCookie)
      .send("role=100")
      .expect(toRedirect("/files?dir=."));
  });
  it("serve file to public after role change", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/files/serve/rick.png").expect(toSucceed());
  });
  it("delete file", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/files/delete/rick.png")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/files?dir=."));
  });
  it("upload file", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/files/upload")
      .set("Cookie", loginCookie)
      .attach("file", Buffer.from("helloiamasmallfile", "utf-8"))

      .expect(toRedirect("/files?dir=."));
  });
});
describe("files edit", () => {
  it("creates table and view", async () => {
    const table = await Table.create("thefiletable");
    await table.update({ min_role_read: 8, min_role_write: 8 });
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
          { type: "Action", action_name: "Save", minRole: 100 },
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
      min_role: 100,
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
