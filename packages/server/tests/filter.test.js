const request = require("supertest");
const getApp = require("../app");
const { resetToFixtures, load_url_dom } = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");
const { plugin_with_routes, sleep } = require("@saltcorn/data/tests/mocks");

afterAll(db.close);
beforeAll(async () => {
  await resetToFixtures();
});

jest.setTimeout(30000);

describe("JSDOM-E2E filter test", () => {
  it("should load authorlist", async () => {
    const dom = await load_url_dom("/view/authorlist");
    //console.log("dom", dom);
  });
  it("should user filter to change url", async () => {
    await View.create({
      viewtemplate: "Filter",
      description: "",
      min_role: 100,
      name: `authorfilter1`,
      table_id: Table.findOne("books")?.id,
      default_render_page: "",
      slug: {},
      attributes: {},
      configuration: {
        layout: {
          type: "field",
          block: false,
          fieldview: "edit",
          textStyle: "",
          field_name: "author",
          configuration: {},
        },
        columns: [
          {
            type: "Field",
            block: false,
            fieldview: "edit",
            textStyle: "",
            field_name: "author",
            configuration: {},
          },
        ],
      },
    });
    const dom = await load_url_dom("/view/authorfilter1");
    expect(dom.window.location.href).toBe(
      "http://localhost/view/authorfilter1"
    );
    //console.log(dom.serialize());
    const input = dom.window.document.querySelector("input[name=author]");
    input.value = "Leo";
    input.dispatchEvent(new dom.window.Event("change"));
    await sleep(1000);
    expect(dom.window.location.href).toBe(
      "http://localhost/view/authorfilter1?author=Leo"
    );

    //console.log("dom", dom);
  });
});
