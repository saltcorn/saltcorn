import { request as request } from "../auth/testhelp.js";
import getApp from "../app.js";
import { resetToFixtures, load_url_dom } from "../auth/testhelp.js";
import db from "@saltcorn/data/db";
import { getState } from "@saltcorn/data/db/state";
import View from "@saltcorn/data/models/view";
import Table from "@saltcorn/data/models/table";
import { plugin_with_routes, sleep } from "@saltcorn/data/tests/mocks";

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
    const input = dom.window.document.querySelector("input[id=inputauthor]");
    input.value = "Leo";
    input.dispatchEvent(new dom.window.Event("change"));
    await sleep(1000);
    expect(dom.window.location.href).toBe(
      "http://localhost/view/authorfilter1?author=Leo"
    );

    //console.log("dom", dom);
  });
});

describe("Filter state badges", () => {
  it("should not inject query keys into badge javascript", async () => {
    await View.create({
      viewtemplate: "Filter",
      description: "",
      min_role: 100,
      name: `badgefilter`,
      table_id: Table.findOne("books")?.id,
      default_render_page: "",
      slug: {},
      attributes: {},
      configuration: {
        layout: {
          type: "search_bar",
          autofocus: false,
          show_badges: true,
          has_dropdown: false,
        },
        columns: [],
      },
    });
    const app = await getApp({ disableCsrf: true });
    const res = await request(app).get(
      "/view/badgefilter?x%27)%3Balert(document.domain)%3B%2F%2F=1"
    );
    expect(res.statusCode).toBe(200);
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM(res.text);
    const links = [...dom.window.document.querySelectorAll(".badge a")];
    expect(links.length).toBe(1);
    for (const link of links) {
      // attribute values as the browser decodes them
      expect(link.getAttribute("href") || "").not.toContain("alert");
      expect(link.getAttribute("onclick") || "").not.toContain("alert");
    }
    expect(links[0].dataset.stateKey).toBe("x');alert(document.domain);//");
  });
});
