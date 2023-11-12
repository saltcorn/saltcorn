const request = require("supertest");
const getApp = require("../app");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  toRedirect,
  itShouldRedirectUnauthToLogin,
  toInclude,
  succeedJsonWith,
  toSucceed,
  toNotInclude,
  resetToFixtures,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const Page = require("@saltcorn/data/models/page");
const File = require("@saltcorn/data/models/file");
const { existsSync } = require("fs");
const { join } = require("path");

let htmlFile = null;

const prepHtmlFiles = async () => {
  const createFile = async (folder, name, content) => {
    const scFolder = join(
      db.connectObj.file_store,
      db.getTenantSchema(),
      folder
    );
    if (!existsSync(scFolder)) await File.new_folder(folder);
    if (!existsSync(join(scFolder, name))) {
      return await File.from_contents(
        name,
        "text/html",
        `<html><head><title>Landing page</title></head><body><h1>${content}</h1></body></html>`,
        1,
        1,
        folder
      );
    } else {
      const file = await File.from_file_on_disk(name, scFolder);
      file.location = File.absPathToServePath(file.location);
      return file;
    }
  };
  htmlFile = await createFile("/", "fixed_page.html", "Land here");
  await createFile("/subfolder", "fixed_page2.html", "Or Land here");
};

beforeAll(async () => {
  await resetToFixtures();
  await prepHtmlFiles();
});
afterAll(db.close);

describe("db page", () => {
  it("shows to public", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/page/a_page").expect(toInclude(">Bye bye<"));
  });
  it("404s not found", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/page/b_page").expect(toInclude("not found", 404));
  });
});
describe("page create", () => {
  it("show new", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/pageedit/new")
      .set("Cookie", loginCookie)
      .expect(toInclude("A short name that will be in your URL"));
  });
  it("shows new with html file selector", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/pageedit/new")
      .set("Cookie", loginCookie)
      .expect(toInclude("HTML file"))
      .expect(toInclude("fixed_page.html"))
      .expect(toInclude(join("subfolder", "fixed_page2.html")));
  });
  it("fills basic details", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/pageedit/edit-properties")
      .send("name=whales&title=Whales&description=about+whales&min_role=100")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/pageedit/edit/whales"));
  });
  it("fills details with html-file", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/pageedit/edit-properties")
      .send(
        `name=new_page_with_html_file&title=foo&description=bar&min_role=100&html_file=${encodeURIComponent(
          htmlFile.location
        )}`
      )
      .set("Cookie", loginCookie)
      .expect(toRedirect("/pageedit/"));
  });
  it("fills layout", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/pageedit/edit/whales")
      .send(
        "contextEnc=%257B%2522name%2522%253A%2522whales%2522%252C%2522title%2522%253A%2522Whales%2522%252C%2522description%2522%253A%2522about%2520whales%2522%252C%2522min_role%2522%253A%252210%2522%257D&stepName=Layout&columns=%255B%255D&layout=%257B%2522above%2522%253A%255B%257B%2522type%2522%253A%2522blank%2522%252C%2522contents%2522%253A%2522Hello%2520world%2522%252C%2522block%2522%253Afalse%252C%2522textStyle%2522%253A%2522%2522%257D%252C%257B%2522type%2522%253A%2522view%2522%252C%2522view%2522%253A%2522authorlist%2522%252C%2522name%2522%253A%2522d51d4b%2522%252C%2522state%2522%253A%2522fixed%2522%257D%255D%257D"
      )
      .set("Cookie", loginCookie)
      .expect(toRedirect("/pageedit"));
  });

  it("shows page", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/page/whales")
      .set("Cookie", loginCookie)
      .expect(toInclude("Herman"));
  });

  it("shows page with html file", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/page/new_page_with_html_file")
      .set("Cookie", loginCookie)
      .expect(toInclude("Land here"));
  });

  it("does not find the html file for staff or public", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/page/new_page_with_html_file")
      .set("Cookie", loginCookie)
      .expect(toInclude("not found", 404));
    await request(app)
      .get("/page/new_page_with_html_file")
      .expect(toInclude("not found", 404));
  });

  it("finds the html file for staff (after update)", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/files/setrole/fixed_page.html")
      .set("Cookie", await getAdminLoginCookie())
      .send("role=40")
      .expect(toRedirect("/files?dir=."));
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/page/new_page_with_html_file")
      .set("Cookie", loginCookie)
      .expect(toInclude("Land here"));
    await request(app)
      .get("/page/new_page_with_html_file")
      .expect(toInclude("not found", 404));
  });
});

describe("page action", () => {
  it("should create", async () => {
    await Page.create({
      name: "pagewithaction",
      title: "",
      description: "",
      min_role: 100,
      id: 2,
      layout: {
        widths: [6, 6],
        besides: [
          { type: "blank", contents: "Hello world", isFormula: {} },
          {
            type: "action",
            rndid: "56f3ac",
            minRole: 100,
            isFormula: {},
            action_icon: "far fa-angry",
            action_name: "run_js_code",
            action_label: "GO",
            configuration: { code: "console.log(1)" },
          },
        ],
      },
      fixed_states: {},
    });
  });
  it("shows page", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/page/pagewithaction")
      .expect(toInclude('<i class="far fa-angry"></i>'));
  });
  it("run action", async () => {
    const oldConsoleLog = console.error;
    console.log = jest.fn();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/page/pagewithaction/action/56f3ac")
      .set("X-Requested-With", "xmlhttprequest")
      .expect(succeedJsonWith((r) => r === "ok"));
    expect(console.log).toHaveBeenCalled();
    console.log = oldConsoleLog;
  });
});

describe("pageedit", () => {
  it("show list", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/pageedit")
      .set("Cookie", loginCookie)

      .expect(toInclude("a_page"));
  });
  it("show edit", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/pageedit/edit-properties/a_page")
      .set("Cookie", loginCookie)
      .expect(toInclude("A short name that will be in your URL"));

    //TODO full context
    const ctx = encodeURIComponent(JSON.stringify({}));
    await request(app)
      .post("/pageedit/edit-properties")
      .set("Cookie", loginCookie)
      .send("name=a_page")
      .send("title=mytitle")
      .send("description=mydescript")
      .send("min_role=80")
      .send("id=1")
      .expect(toRedirect("/pageedit/"));
  });
  it("show builder", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/pageedit/edit/a_page")
      .set("Cookie", loginCookie)
      .expect(toInclude("<script>builder.renderBuilder"));
  });

  it("sets root page", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/pageedit/set_root_page")
      .send("public_home=a_page")
      .send("staff_home=")
      .send("user_home=")
      .send("admin_home=")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/pageedit"));
    await request(app)
      .get("/pageedit")
      .set("Cookie", loginCookie)

      .expect(toInclude("Root pages updated"));
  });
  it("should delete page", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/pageedit/delete/1")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/pageedit"));

    await request(app)
      .get("/pageedit")
      .set("Cookie", loginCookie)
      .expect(toNotInclude("a_page"));
  });
});
