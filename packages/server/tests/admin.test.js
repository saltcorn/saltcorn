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
  respondJsonWith,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const fs = require("fs").promises;
const File = require("@saltcorn/data/models/file");
const User = require("@saltcorn/data/models/user");
const EventLog = require("@saltcorn/data/models/eventlog");

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
const adminPageContains = (specs) =>
  it("adminPageContains " + specs.map((s) => s[1]).join(","), async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    for (const [url, text] of specs) {
      await request(app)
        .get(url)
        .set("Cookie", loginCookie)
        .expect(toInclude(text));
    }
  });
describe("admin page", () => {
  itShouldRedirectUnauthToLogin("/settings");
  itShouldRedirectUnauthToLogin("/admin");
  it("show settings page", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/settings")
      .set("Cookie", loginCookie)
      .expect(toInclude("Plugin and pack installation and control"));
  });
  it("show admin page", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/admin")
      .set("Cookie", loginCookie)
      .expect(toInclude("Site identity settings"));
  });
  adminPageContains([
    ["/admin/backup", "Download a backup"],
    ["/admin/email", "Email settings"],
    ["/admin/system", "Restart server"],
  ]);
  adminPageContains([
    ["/useradmin", "Create user"],
    ["/roleadmin", "Theme"],
    ["/useradmin/settings", "Authentication settings"],
    ["/useradmin/ssl", "HTTPS encryption"],
  ]);
  adminPageContains([
    ["/menu", "jquery-menu-editor"],
    ["/search/config", "Search configuration"],
  ]);
  adminPageContains([["/actions", "Actions available"]]);
  adminPageContains([["/eventlog", "Event log"]]);
  adminPageContains([
    ["/eventlog/settings", "Which events should be logged?"],
  ]);
  it("show download backup", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/admin/backup")
      .set("Cookie", loginCookie)
      .expect(toSucceed());
  });
});

describe("event log", () => {
  itShouldRedirectUnauthToLogin("/eventlog");
  itShouldRedirectUnauthToLogin("/eventlog/settings");
  it("show enable loginattempt logging", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/eventlog/settings")
      .set("Cookie", loginCookie)
      .send("LoginFailed=on")
      .expect(toRedirect("/actions/logsettings"));
  });

  it("tries to log in with wrong password", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/auth/login/")
      .send("email=staff@foo.com")
      .send("password=fotyjtyjr")
      .expect(toRedirect("/auth/login"));
  });

  it("shows entry in event log list", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/eventlog")
      .set("Cookie", loginCookie)
      .expect(toInclude("LoginFailed"));
  });
  it("shows an entry in event log", async () => {
    const evs = await EventLog.find({})
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/eventlog/"+evs[0].id)
      .set("Cookie", loginCookie)
      .expect(toInclude("table eventlog"));
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
    const oldConsoleError = console.error;
    console.error = jest.fn();

    await request(app)
      .get("/crashlog/99")
      .set("Cookie", loginCookie)
      .expect(toInclude("squirrels", 500));
    expect(console.error).toHaveBeenCalled();
    console.error = oldConsoleError;
  });

  it("show crashlog list with errors", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/crashlog")
      .set("Cookie", loginCookie)
      .expect(toInclude("Show"))
      .expect(toInclude('no _sc_errors where "id"'));
  });
  it("show crashlog entry", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/crashlog/1")
      .set("Cookie", loginCookie)
      .expect(toInclude('no _sc_errors where "id"'))
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
    const menu_json = [
      {
        text: "eteteyy",
        href: "",
        icon: "fab fa-accessible-icon",
        target: "_self",
        title: "",
        url: "",
        type: "Header",
        label: "eteteyy",
        min_role: "1",
        pagename: null,
        viewname: "dqwdw",
        children: [
          {
            text: "fghjjtryj",
            href: "",
            icon: "undefined",
            target: "_self",
            title: "",
            url: "",
            type: "View",
            label: "fghjjtryj",
            min_role: "1",
            pagename: null,
            viewname: "dqwdw",
          },
          {
            text: "withicon",
            href: "",
            icon: "fab fa-affiliatetheme",
            target: "_self",
            title: "",
            url: "",
            type: "View",
            label: "withicon",
            min_role: "1",
            pagename: null,
            viewname: "dqwdw",
          },
        ],
      },
      {
        text: "wicon",
        href: "",
        icon: "fas fa-address-card",
        target: "_self",
        title: "",
        url: "",
        type: "View",
        label: "wicon",
        min_role: "1",
        pagename: null,
        viewname: "dqwdw",
      },
      {
        text: "BarMenu",
        href: "",
        icon: "empty",
        target: "_self",
        title: "",
        url: "",
        type: "View",
        label: "BarMenu",
        min_role: "10",
        pagename: null,
        viewname: "dqwdw",
      },
    ];
    await request(app)
      .post("/menu")
      .set("Cookie", loginCookie)
      .send("menu=" + encodeURIComponent(JSON.stringify(menu_json)))
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
  it("get sitemap", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/sitemap.xml")
      .expect(toInclude("view/dqwdw"))
      .expect(toInclude("<urlset"));
  });
});

describe("roleadmin", () => {
  itShouldRedirectUnauthToLogin("/roleadmin");
  itShouldRedirectUnauthToLogin("/roleadmin/new");
  it("show edit form", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/roleadmin/new")
      .set("Cookie", loginCookie)
      .expect(toInclude("rank of the user"));
  });
  it("show create now role", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/roleadmin/edit")
      .set("Cookie", loginCookie)
      .send("id=5")
      .send("role=muppets")
      .expect(toRedirect("/roleadmin"));
    const roles = await User.get_roles();
    expect(roles).toContainEqual({ id: 5, role: "muppets" });
  });
  it("show set layout for role", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/roleadmin/setrolelayout/5")
      .set("Cookie", loginCookie)
      .send("layout=tabler")
      .expect(toRedirect("/roleadmin"));
    const roles = await User.get_roles();
    expect(roles).toContainEqual({ id: 5, role: "muppets" });
  });
  it("show delete role", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/roleadmin/delete/5")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/roleadmin"));
    const roles = await User.get_roles();
    expect(roles).not.toContainEqual({ id: 5, role: "muppets" });
  });
});
describe("actions", () => {
  itShouldRedirectUnauthToLogin("/actions");
  it("show actions editor", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/actions")
      .set("Cookie", loginCookie)
      .expect(toInclude("Actions available"))
      .expect(toInclude("webhook"));
  });
  it("show new action", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/actions/trigger/new")
      .set("Cookie", loginCookie)
      .expect(toInclude("New trigger"))
      .expect(toInclude("webhook"));
  });
  it("post trigger", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/actions/trigger")
      .set("Cookie", loginCookie)
      .send("action=run_js_code")
      .send("table_id=2")
      .send("when_trigger=Insert")
      .expect(toRedirect("/actions/configure/1"));
  });
  it("show edit", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/actions/trigger/1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Edit trigger"))
      .expect(toInclude("run_js_code"));
  });
  it("show configure", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/actions/configure/1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Configure trigger"))
      .expect(toInclude("Code"));
  });
  it("post config", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/actions/configure/1")
      .set("Cookie", loginCookie)
      .send("code=console.log(12345678)")
      .expect(toRedirect("/actions/"));
  });
  it("test run", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/actions/testrun/1")
      .set("Cookie", loginCookie)
      .expect(toInclude("12345678"));
  });
  it("post config with no console output", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/actions/configure/1")
      .set("Cookie", loginCookie)
      .send("code=1")
      .expect(toRedirect("/actions/"));
  });
  it("test run with no console output", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/actions/testrun/1")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/actions/"));
  });
  it("create api trigger", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/actions/trigger")
      .set("Cookie", loginCookie)
      .send("name=myact")
      .send("action=run_js_code")
      .send("when_trigger=API+call")
      .expect(toRedirect("/actions/configure/2"));
    await request(app)
      .post("/actions/configure/2")
      .set("Cookie", loginCookie)
      .send("code=return 27")
      .expect(toRedirect("/actions/"));
    await request(app)
      .post("/api/action/myact")
      .set("Cookie", loginCookie)
      .expect(
        respondJsonWith(200, ({ success, data }) => success && data === 27)
      );
  });
  it("deletes trigger", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/actions/delete/1")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/actions/"));
  });
});
describe("clear all page", () => {
  itShouldRedirectUnauthToLogin("/admin/clear-all");
  it("show page", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/admin/clear-all")
      .set("Cookie", loginCookie)
      .expect(toInclude("EVERYTHING"));
  });
  it("post and clear", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/admin/clear-all")
      .set("Cookie", loginCookie)
      .send("tables=on")
      .send("views=on")
      .send("pages=on")
      .send("files=on")
      .send("users=on")
      .send("config=on")
      .send("plugins=on")
      .expect(toRedirect("/auth/create_first_user"));
  });
});
