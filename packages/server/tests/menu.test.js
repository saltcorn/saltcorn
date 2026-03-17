const request = require("supertest");
const getApp = require("../app");
const {
  getAdminLoginCookie,
  getStaffLoginCookie,
  toInclude,
  succeedJsonWith,
  toSucceed,
  toNotInclude,
  resetToFixtures,
} = require("../auth/testhelp");
const { save_menu_items } = require("@saltcorn/data/models/config");

const db = require("@saltcorn/data/db");
const Page = require("@saltcorn/data/models/page");

beforeAll(async () => {
  await resetToFixtures();
});
afterAll(db.close);

const createPagesIssue2952 = async () => {
  await Page.create({
    name: "test",
    title: "myTitle",
    description: "desc",
    min_role: 100,
    layout: {
      above: [
        {
          type: "blank",
          block: false,
          contents: "test",
          textStyle: "",
        },
      ],
    },
    fixed_states: {},
  });
  await Page.create({
    name: "test-second",
    title: "myTitle",
    description: "desc",
    min_role: 100,
    layout: {
      above: [
        {
          type: "blank",
          block: false,
          contents: "test-second",
          textStyle: "",
        },
      ],
    },
    fixed_states: {},
  });

  await save_menu_items([
    {
      text: "test",
      href: "",
      icon: "undefined",
      target: "_self",
      title: "",
      type: "Page",
      label: "test",
      style: "",
      tooltip: "",
      in_modal: false,
      location: "Standard",
      max_role: "1",
      min_role: "1",
      pagename: "test",
      target_blank: false,
      disable_on_mobile: false,
      children: undefined,
    },
    {
      text: "test-second",
      href: "",
      icon: "undefined",
      target: "_self",
      title: "",
      type: "Page",
      label: "test-second",
      style: "",
      tooltip: "",
      in_modal: false,
      location: "Standard",
      max_role: "1",
      min_role: "1",
      pagename: "test-second",
      target_blank: false,
      disable_on_mobile: false,
      children: undefined,
    },
  ]);
};

describe("Menu tests", () => {
  it("highlights active menu item", async () => {
    await createPagesIssue2952();
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    {
      const res = await request(app)
        .get("/page/test")
        .set("Cookie", loginCookie);
      const matches = res.text.match(/class="nav-item active"/g);
      expect(matches).toBeTruthy();
      expect(matches?.length).toBe(1);
    }
    {
      const res = await request(app)
        .get("/page/test-second")
        .set("Cookie", loginCookie);
      expect(true).toBe(true);
      const matches = res.text.match(/class="nav-item active"/g);
      expect(matches).toBeTruthy();
      expect(matches?.length).toBe(1);
    }
  });
});

describe("Menu keyboard shortcuts", () => {
  it("menu editor form includes shortcut field", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app).get("/menu").set("Cookie", loginCookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain('name="shortcut"');
    expect(res.text).toContain("Keyboard shortcut");
  });

  it("injects _sc_menu_shortcuts when shortcuts are configured", async () => {
    await save_menu_items([
      {
        type: "Page",
        label: "test",
        pagename: "test",
        min_role: "100",
        max_role: "1",
        location: "Standard",
        style: "",
        shortcut: "Alt+k",
      },
    ]);
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .get("/page/a_page")
      .set("Cookie", loginCookie);
    expect(res.text).toContain("_sc_menu_shortcuts");
    expect(res.text).toContain("Alt+k");
  });

  it("does not inject _sc_menu_shortcuts when no shortcuts configured", async () => {
    await save_menu_items([
      {
        type: "Page",
        label: "test",
        pagename: "test",
        min_role: "100",
        max_role: "1",
        location: "Standard",
        style: "",
      },
    ]);
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .get("/page/a_page")
      .set("Cookie", loginCookie);
    expect(res.text).not.toContain("_sc_menu_shortcuts");
  });

  it("does not inject shortcuts for staff when min_role is admin only", async () => {
    await save_menu_items([
      {
        type: "Page",
        label: "test",
        pagename: "test",
        min_role: "1",
        max_role: "1",
        location: "Standard",
        style: "",
        shortcut: "Alt+k",
      },
    ]);
    const app = await getApp({ disableCsrf: true });
    const staffCookie = await getStaffLoginCookie();
    const res = await request(app)
      .get("/page/a_page")
      .set("Cookie", staffCookie);
    expect(res.text).not.toContain("_sc_menu_shortcuts");

    const adminCookie = await getAdminLoginCookie();
    const resAdmin = await request(app)
      .get("/page/a_page")
      .set("Cookie", adminCookie);
    expect(resAdmin.text).toContain("_sc_menu_shortcuts");
  });

  it("collects shortcuts from nested subitems", async () => {
    await save_menu_items([
      {
        type: "Header",
        label: "Section",
        min_role: "100",
        max_role: "1",
        location: "Standard",
        style: "",
        subitems: [
          {
            type: "Page",
            label: "nested-test",
            pagename: "test",
            min_role: "100",
            max_role: "1",
            location: "Standard",
            style: "",
            shortcut: "Alt+n",
          },
        ],
      },
    ]);
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .get("/page/a_page")
      .set("Cookie", loginCookie);
    expect(res.text).toContain("_sc_menu_shortcuts");
    expect(res.text).toContain("Alt+n");
  });
});
