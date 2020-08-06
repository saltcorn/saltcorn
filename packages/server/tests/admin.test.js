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
  resetToFixtures
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const fs = require("fs").promises;
const File = require("@saltcorn/data/models/file");

beforeAll(async () => {
  await resetToFixtures();
  const mv = async fnm => {
    await fs.writeFile(fnm, "nevergonnagiveyouup");
  };
  await File.from_req_files(
    { mimetype: "image/png", name: "rick.png", mv, size: 245752 },
    1,
    4
  );
});
afterAll(db.close);

describe("admin page", () => {
  itShouldRedirectUnauthToLogin("/admin");
  it("show admin page", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/admin")
      .set("Cookie", loginCookie)
      .expect(toInclude("Restart"));
  });
  it("show download backup", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/admin/backup")
      .set("Cookie", loginCookie)
      .expect(toSucceed());
  });
});

describe("crash log", () => {
  itShouldRedirectUnauthToLogin("/crashlog");
  it("show crashlog list", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/crashlog")
      .set("Cookie", loginCookie)
      .expect(toInclude("No errors reported"));
  });
  it("crashes on missing id", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/crashlog/99")
      .set("Cookie", loginCookie)
      .expect(toInclude("squirrels", 500));
  });
  it("show crashlog list with errors", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/crashlog")
      .set("Cookie", loginCookie)
      .expect(toInclude("Show"))
      .expect(toInclude("no _sc_errors where id"));
  });
  it("show crashlog entry", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/crashlog/1")
      .set("Cookie", loginCookie)
      .expect(toInclude("no _sc_errors where id"))
      .expect(toInclude("stack"));
  });
});

describe("menu editor", () => {
  itShouldRedirectUnauthToLogin("/menu");
  it("show menu editor", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/menu")
      .set("Cookie", loginCookie)
      .expect(toInclude("Menu editor"));
  });
  it("post menu", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/menu")
      .set("Cookie", loginCookie)
      .send("site_name=Saltcorn")
      .send("site_logo_id=0")
      .send("type_0=View")
      .send("label_0=Foo")
      .send("min_role_0=10")
      .send("url_0=")
      .send("pagename_0=a_page")
      .send("viewname_0=authorlist")
      .send("type_1=Page")
      .send("label_1=Projects")
      .send("min_role_1=10")
      .send("url_1=")
      .send("pagename_1=a_page")
      .send("viewname_1=authorlist")
      .send("type_2=Link")
      .send("label_2=BarMenu")
      .send("min_role_2=10")
      .send("url_2=https%3A%2F%2Fgithub.com%2Fsaltcorn%2Fsaltcorn")
      .send("pagename_2=a_page")
      .send("viewname_2=authorlist")
      .expect(toRedirect("/menu"));
  });
  it("show new menu", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/")
      .set("Cookie", loginCookie)
      .expect(toInclude("BarMenu"));
  });
});

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
      .get("/files/download/1")
      .set("Cookie", loginCookie)
      .expect(toSucceed());
  });

  it("serve file", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/files/serve/1")
      .set("Cookie", loginCookie)
      .expect(toSucceed());
  });
  it("not serve file to public", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/files/serve/1")
      .expect(toRedirect("/"));
  });
  it("set file min role", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/files/setrole/1")
      .set("Cookie", loginCookie)
      .send("role=10")
      .expect(toRedirect("/files"));
  });
  it("serve file to public after role change", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/files/serve/1")
      .expect(toSucceed());
  });
});
