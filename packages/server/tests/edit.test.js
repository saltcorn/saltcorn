const request = require("supertest");
const getApp = require("../app");
const { resetToFixtures, load_url_dom } = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const View = require("@saltcorn/data/models/view");
const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const { plugin_with_routes, sleep } = require("@saltcorn/data/tests/mocks");

afterAll(db.close);
beforeAll(async () => {
  await resetToFixtures();
  const table = Table.findOne("books");
  await Field.create({
    table,
    name: "sequel_to",
    type: "Key to books",
  });
  await table.insertRow({
    author: "Peter Kropotkin",
    pages: 189,
    publisher: 1,
  });

  await table.insertRow({
    author: "Mary Boas",
    pages: 864,
    publisher: 2,
  });
});

jest.setTimeout(30000);

describe("JSDOM-E2E filter test", () => {
  it("should user filter to change url", async () => {
    await View.create({
      viewtemplate: "Edit",
      description: "",
      min_role: 100,
      name: `AuthorEditForTest`,
      table_id: Table.findOne("books")?.id,
      default_render_page: "",
      slug: {},
      attributes: {},
      configuration: {
        layout: {
          above: [
            {
              gx: null,
              gy: null,
              style: {
                "margin-bottom": "1.5rem",
              },
              aligns: ["end", "start"],
              widths: [2, 10],
              besides: [
                {
                  font: "",
                  type: "blank",
                  block: false,
                  style: {},
                  inline: false,
                  contents: "Publisher",
                  labelFor: "publisher",
                  isFormula: {},
                  textStyle: "",
                },
                {
                  above: [
                    {
                      type: "field",
                      block: false,
                      fieldview: "select",
                      textStyle: "",
                      field_name: "publisher",
                      configuration: {},
                    },
                    {
                      type: "container",
                      style: {},
                      bgType: "None",
                      hAlign: "left",
                      margin: [0, 0, 0, 0],
                      rotate: 0,
                      vAlign: "top",
                      bgColor: "#ffffff",
                      display: "block",
                      padding: [0, 0, 0, 0],
                      bgFileId: 0,
                      contents: {
                        font: "",
                        icon: "",
                        type: "blank",
                        block: false,
                        style: {},
                        inline: false,
                        contents: "Warning",
                        labelFor: "",
                        isFormula: {},
                        textStyle: "",
                      },
                      imageSize: "contain",
                      isFormula: {},
                      minHeight: 0,
                      textColor: "#ffffff",
                      htmlElement: "div",
                      showForRole: [],
                      gradEndColor: "#88ff88",
                      customClass: "pubwarn",
                      setTextColor: false,
                      fullPageWidth: false,
                      gradDirection: "0",
                      showIfFormula: 'publisher.name == "AK Press"',
                      gradStartColor: "#ff8888",
                      minScreenWidth: "",
                      show_for_owner: false,
                    },
                  ],
                },
              ],
              breakpoints: ["", ""],
            },
            {
              gx: null,
              gy: null,
              style: {
                "margin-bottom": "1.5rem",
              },
              aligns: ["end", "start"],
              widths: [2, 10],
              besides: [
                {
                  font: "",
                  type: "blank",
                  block: false,
                  style: {},
                  inline: false,
                  contents: "sequel_to",
                  labelFor: "sequel_to",
                  isFormula: {},
                  textStyle: "",
                },
                {
                  type: "field",
                  block: false,
                  fieldview: "select",
                  textStyle: "",
                  field_name: "sequel_to",
                  configuration: {
                    where: "publisher == $publisher",
                  },
                },
              ],
              breakpoints: ["", ""],
            },
            {
              type: "action",
              block: false,
              rndid: "cb94bd",
              nsteps: "",
              minRole: 100,
              isFormula: {},
              action_icon: "",
              action_name: "Save",
              action_size: "",
              action_bgcol: "",
              action_label: "",
              action_style: "btn-primary",
              action_title: "",
              configuration: {},
              step_only_ifs: "",
              action_textcol: "",
              action_bordercol: "",
              step_action_names: "",
            },
          ],
        },
        columns: [
          {
            type: "Field",
            block: false,
            fieldview: "select",
            textStyle: "",
            field_name: "publisher",
            configuration: {},
          },
          {
            type: "Field",
            block: false,
            fieldview: "select",
            textStyle: "",
            field_name: "sequel_to",
            configuration: {
              where: "publisher == $publisher",
            },
          },
          {
            type: "Action",
            rndid: "cb94bd",
            nsteps: "",
            minRole: 100,
            isFormula: {},
            action_icon: "",
            action_name: "Save",
            action_size: "",
            action_bgcol: "",
            action_label: "",
            action_style: "btn-primary",
            action_title: "",
            configuration: {},
            step_only_ifs: "",
            action_textcol: "",
            action_bordercol: "",
            step_action_names: "",
          },
        ],
        viewname: "AuthorEditForTest",
        auto_save: false,
        split_paste: false,
        exttable_name: null,
        page_when_done: null,
        view_when_done: "authorlist",
        dest_url_formula: null,
        destination_type: "View",
        formula_destinations: [],
        page_group_when_done: null,
      },
    });
    const dom = await load_url_dom("/view/AuthorEditForTest");
    await sleep(1000);
    const pubwarn = dom.window.document.querySelector("div.pubwarn");

    expect(pubwarn.style.display).toBe("none");
    const select = dom.window.document.querySelector("select[name=publisher]");
    select.value = "1";
    select.dispatchEvent(new dom.window.Event("change"));

    await sleep(1000);
    expect(pubwarn.style.display).toBe("");

    /*input.value = "Leo";
    input.dispatchEvent(new dom.window.Event("change"));
    await sleep(2000);
    expect(dom.window.location.href).toBe(
      "http://localhost/view/authorfilter1?author=Leo"
    );
*/
    //console.log("dom", dom);
  });
});
