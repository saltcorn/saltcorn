const request = require("supertest");
const getApp = require("../app");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  toRedirect,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toSucceed,
  resetToFixtures,
  toSucceedWithImage,
  respondJsonWith,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const fs = require("fs").promises;
const path = require("path");
const File = require("@saltcorn/data/models/file");
const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const { existsSync } = require("fs");

const createTestFile = async (folder, name, mimetype, content) => {
  if (
    !existsSync(
      path.join(db.connectObj.file_store, db.getTenantSchema(), folder, name)
    )
  ) {
    await File.from_contents(name, mimetype, content, 1, 100, folder);
  }
};

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
    40
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
    100
  );

  await File.new_folder(path.join("_sc_test_subfolder_one", "subsubfolder"));
  await createTestFile(
    "_sc_test_subfolder_one",
    "foo_image.png",
    "image/png",
    "imagecontent"
  );
  await createTestFile(
    "_sc_test_subfolder_one",
    "bar_image.png",
    "image/png",
    "imagecontent"
  );
  await createTestFile(
    path.join("_sc_test_subfolder_one", "subsubfolder"),
    "bar_image.png",
    "image/png",
    "imagecontent"
  );
  await File.new_folder("_sc_test_subfolder_two");
  await createTestFile(
    "_sc_test_subfolder_two",
    "foo_image.png",
    "image/png",
    "imagecontent"
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
  it("search files by name", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    const checkFiles = (files, expecteds) =>
      files.length === expecteds.length &&
      expecteds.every(({ filename, location }) =>
        files.find(
          (file) => file.filename === filename && file.location === location
        )
      );
    const searchTestHelper = async (dir, search, expected) => {
      await request(app)
        .get("/files")
        .query({ dir, search })
        .set("X-Requested-With", "XMLHttpRequest")
        .set("Cookie", loginCookie)
        .expect(
          respondJsonWith(200, (data) => checkFiles(data.files, expected))
        );
    };

    await searchTestHelper("/", "foo", [
      {
        filename: "foo_image.png",
        location: path.join("_sc_test_subfolder_one", "foo_image.png"),
      },
      {
        filename: "foo_image.png",
        location: path.join("_sc_test_subfolder_two", "foo_image.png"),
      },
    ]);
    await searchTestHelper("_sc_test_subfolder_two", "foo", [
      {
        filename: "foo_image.png",
        location: path.join("_sc_test_subfolder_two", "foo_image.png"),
      },
      {
        filename: "..",
        location: "",
      },
    ]);
    await searchTestHelper("/", "bar", [
      {
        filename: "bar_image.png",
        location: path.join("_sc_test_subfolder_one", "bar_image.png"),
      },
      {
        filename: "bar_image.png",
        location: path.join(
          "_sc_test_subfolder_one",
          "subsubfolder",
          "bar_image.png"
        ),
      },
    ]);
    await searchTestHelper(
      path.join("_sc_test_subfolder_one", "subsubfolder"),
      "foo",
      [
        {
          filename: "..",
          location: "_sc_test_subfolder_one",
        },
      ]
    );
    await searchTestHelper(
      path.join("_sc_test_subfolder_one", "subsubfolder"),
      "bar",
      [
        {
          filename: "..",
          location: "_sc_test_subfolder_one",
        },
        {
          filename: "bar_image.png",
          location: path.join(
            "_sc_test_subfolder_one",
            "subsubfolder",
            "bar_image.png"
          ),
        },
      ]
    );
  });
});
describe("files edit", () => {
  it("creates table and view", async () => {
    const table = await Table.create("thefiletable");
    await table.update({ min_role_read: 80, min_role_write: 80 });
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
    const table = Table.findOne({ name: "thefiletable" });
    const row = await table.getRow({ first_name: "elvis" });
    const file = await File.findOne({ id: row.mugshot });
    expect(!!file).toBe(true);
  });
});
