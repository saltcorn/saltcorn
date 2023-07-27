const request = require("supertest");
const getApp = require("../app");
const Table = require("@saltcorn/data/models/table");
const Plugin = require("@saltcorn/data/models/plugin");
const { getState, add_tenant } = require("@saltcorn/data/db/state");
const { install_pack } = require("@saltcorn/admin-models/models/pack");
const {
  switchToTenant,
  insertTenant,
  create_tenant,
} = require("@saltcorn/admin-models/models/tenant");
const {
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  toRedirect,
  resetToFixtures,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const load_plugins = require("../load_plugins");

beforeAll(async () => {
  if (!db.isSQLite) await db.query(`drop schema if exists test101 CASCADE `);
  await resetToFixtures();
});
afterAll(db.close);

jest.setTimeout(30000);

describe("Plugin Endpoints", () => {
  it("should show list", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/plugins")
      .set("Cookie", loginCookie)
      .expect(toInclude("Module store"));
  });

  it("should show new", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/plugins/new")
      .set("Cookie", loginCookie)
      .expect(toInclude("New Plugin"));
  });

  itShouldRedirectUnauthToLogin("/plugins");
  itShouldRedirectUnauthToLogin("/plugins/new");

  it("should install named with config", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/plugins/install/any-bootstrap-theme")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/plugins/configure/any-bootstrap-theme"));
    await request(app)
      .get("/plugins")
      .set("Cookie", loginCookie)
      .expect(toInclude("/plugins/configure/"));
  });
  it("should run config", async () => {
    const p = await Plugin.findOne({ name: "any-bootstrap-theme" });
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/plugins/configure/" + p.name)
      .set("Cookie", loginCookie)
      .expect(toInclude("Navbar color scheme"));
    await request(app)
      .post("/plugins/configure/" + p.name)
      .set("Cookie", loginCookie)
      .send(
        "theme=flatly&css_url=&css_integrity=&colorscheme=navbar-light&toppad=2&menu_style=Top+Navbar&stepName=stylesheet&contextEnc=%257B%257D"
      )
      .expect(toRedirect("/plugins"));
  });
  it("should show info and delete", async () => {
    const p = await Plugin.findOne({ name: "any-bootstrap-theme" });
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/plugins/info/" + p.name)
      .set("Cookie", loginCookie)
      .expect(toInclude("This plugin supplies a theme."));
    await request(app)
      .get("/plugins/public/any-bootstrap-theme/test.txt")
      .expect(toInclude("testfilecontents"));
    await request(app)
      .get(
        "/plugins/pubdeps/sbadmin2/startbootstrap-sb-admin-2-bs5/4.1.5-beta.4/css/sb-admin-2.min.css"
      )
      .expect(toInclude("Start Bootstrap"));

    await request(app)
      .post("/plugins/delete/" + p.name)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/plugins"));
    await request(app)
      .get(
        "/plugins/pubdeps/sbadmin2/startbootstrap-sb-admin-2-bs5/4.1.5-beta.4/css/sb-admin-2.min.css"
      )
      .expect(toInclude("Start Bootstrap"));
  });
  it("should install named without config", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/plugins/install/markdown")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/plugins"));
    await request(app)
      .get("/plugins")
      .set("Cookie", loginCookie)
      .expect(toInclude("/plugins/delete/markdown"));
    await request(app)
      .get("/plugins/info/markdown")
      .set("Cookie", loginCookie)
      .expect(toInclude("md_to_html()"));
  });
});
describe("Plugin dependency resolution and upgrade", () => {
  it("should install quill", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/plugins/")
      .set("Cookie", loginCookie)
      .send("name=quill-editor")
      .send("source=npm")
      .send("location=%40saltcorn%2Fquill-editor")
      .expect(toRedirect("/plugins"));
    const quill = await Plugin.findOne({ name: "quill-editor" });
    expect(quill.location).toBe("@saltcorn/quill-editor");
    const html = await Plugin.findOne({ location: "@saltcorn/html" });
    expect(html.location).toBe("@saltcorn/html");
    const html_type = getState().types.HTML;
    expect(!!html_type.fieldviews.Quill).toBe(true);
  });
  it("should install old tabler", async () => {
    const tabler = new Plugin({
      name: "tabler",
      source: "npm",
      location: "@saltcorn/tabler",
      version: "0.1.2",
    });
    await load_plugins.loadAndSaveNewPlugin(tabler);
  });
  it("should refresh store", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/plugins/refresh")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/plugins"));
  });
  it("should upgrade installed", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/plugins/upgrade")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/plugins"));
    const tabler = await Plugin.findOne({ name: "tabler" });
    expect(tabler.version).not.toBe("0.1.2");

    expect(version_to_int(tabler.version)).toBeGreaterThan(1);
    expect(version_to_int(tabler.version)).toBeLessThan(912);
  });
});

const version_to_int = (v) => +v.split(".").join("");

describe("Pack Endpoints", () => {
  it("should show get create", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/packs/create/")
      .set("Cookie", loginCookie)
      .expect(toInclude("Create Pack"));
  });
  it("should create pack", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/packs/create/")
      .set("Cookie", loginCookie)
      .send(
        "table.books=on&view.authorlist=on&view.authorshow=on&plugin.sbadmin2=on&page.a_page=on"
      )
      .expect(toInclude("You can copy the pack contents below"));
  });

  it("should show get install", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/packs/install/")
      .set("Cookie", loginCookie)
      .expect(toInclude("Install Pack"));
  });
  it("should install blank pack", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/packs/install/")
      .set("Cookie", loginCookie)
      .send(
        "pack=%7B+%22tables%22%3A+%5B%5D%2C+%22views%22%3A+%5B%5D%2C+%22plugins%22%3A+%5B%5D%2C+%22pages%22%3A+%5B%5D+%7D"
      )
      .expect(toRedirect("/"));
  });

  it("should show error on wierd pack ", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/packs/install/")
      .set("Cookie", loginCookie)
      .send(
        "pack=les%22%3A+%5B%5D%2C+%22views%22%3A+%5B%5D%2C+%22plugins%22%3A+%5B%5D%2C+%22pages%22%3A+%5B%5D+%7D"
      )
      .expect(toInclude("alert-danger"));
  });
  it("should install named", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/packs/install-named/Project%20management")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/"));
  });
  it("should validate user entry on todo", async () => {
    //db.set_sql_logging();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/view/todoedit")
      .send("description=ZAP&done=on&user=2%2F2&project=&status=Ideas")

      .expect(200)
      .expect(toInclude("Unable to read key"));
  });
  it("should uninstall named", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/packs/uninstall/Project%20management")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/"));
  });

  itShouldRedirectUnauthToLogin("/plugins/new");
});

describe("Pack clash detection", () => {
  it("should reset", async () => {
    await resetToFixtures();
  });
  it("should install issues", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/packs/install-named/Issue%20%20tracker")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/"));
  });
  it("should install issues", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/packs/install-named/Blog")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/plugins"));
    await request(app)
      .get("/plugins")
      .set("Cookie", loginCookie)
      .expect(toInclude("Tables already exist: comments"));
  });
  it("should reset again", async () => {
    await resetToFixtures();
  });
});
describe("config endpoints", () => {
  itShouldRedirectUnauthToLogin("/admin");
  it("should show get list", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/admin/")
      .set("Cookie", loginCookie)
      .expect(toInclude("Site name"))
      .expect(toInclude("<form"));
  });

  it("should show post form", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/admin")
      .send("site_name=FooSiteName")
      .send("multitenancy_enabled=on")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/admin/"));
    await request(app)
      .get("/admin")
      .set("Cookie", loginCookie)
      .expect(toInclude(">FooSiteName<"));
  });
});

const plugin_pack = (plugin) => ({
  tables: [],
  views: [],
  plugins: [
    {
      ...plugin,
      configuration: null,
    },
  ],
  pages: [],
  roles: [],
  library: [],
  triggers: [],
});

describe("Tenant cannot install unsafe plugins", () => {
  if (!db.isSQLite) {
    it("creates a new tenant", async () => {
      db.enable_multi_tenant();
      const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;

      await getState().setConfig("base_url", "http://example.com/");

      add_tenant("test101");

      await switchToTenant(
        await insertTenant("test101", "foo@foo.com", ""),
        "http://test101.example.com/"
      );

      await create_tenant({
        t: "test101",
        loadAndSaveNewPlugin,
        plugin_loader() {},
      });
    });
    it("can install safe plugins on tenant", async () => {
      await db.runWithTenant("test101", async () => {
        const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;

        await install_pack(
          plugin_pack({
            name: "html",
            source: "npm",
            location: "@saltcorn/html",
          }),
          "Todo list",
          loadAndSaveNewPlugin
        );
        const dbPlugin = await Plugin.findOne({ name: "html" });
        expect(dbPlugin).not.toBe(null);
      });
    });
    it("cannot install unsafe plugins on tenant", async () => {
      await db.runWithTenant("test101", async () => {
        const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;

        await install_pack(
          plugin_pack({
            name: "sql-list",
            source: "npm",
            location: "@saltcorn/sql-list",
          }),
          "Todo list",
          loadAndSaveNewPlugin
        );
        const dbPlugin = await Plugin.findOne({ name: "sql-list" });
        expect(dbPlugin).toBe(null);
      });
    });
    it("can install unsafe plugins on tenant when permitted", async () => {
      await getState().setConfig("tenants_unsafe_plugins", true);
      await db.runWithTenant("test101", async () => {
        const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;

        await install_pack(
          plugin_pack({
            name: "sql-list",
            source: "npm",
            location: "@saltcorn/sql-list",
          }),
          "Todo list",
          loadAndSaveNewPlugin
        );
        const dbPlugin = await Plugin.findOne({ name: "sql-list" });
        expect(dbPlugin).not.toBe(null);
      });
    });
  } else {
    it("does not support tenants on SQLite", async () => {
      expect(db.isSQLite).toBe(true);
    });
  }
});
