const request = require("supertest");
const getApp = require("../app");
const {
  getAdminLoginCookie,
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
