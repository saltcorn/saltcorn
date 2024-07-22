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
  await table.update({ min_role_read: 100 });
  await Field.create({
    table,
    name: "sequel_to",
    type: "Key to books",
    attributes: { summary_field: "author" },
  });
  await Field.create({
    table,
    label: "pagesp1",
    type: "Integer",
    calculated: true,
    expression: "pages+1",
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
  const ptable = Table.findOne("publisher");
  await ptable.update({ min_role_read: 100 });

  //await getState().setConfig("log_level", 6);
});

jest.setTimeout(30000);

const makeJoinSelectView = async ({ name, showIfFormula }) => {
  await View.create({
    viewtemplate: "Edit",
    description: "",
    min_role: 100,
    name,
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
                      above: [
                        {
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
                        {
                          type: "join_field",
                          block: false,
                          fieldview: "as_text",
                          textStyle: "",
                          join_field: "publisher.name",
                          configuration: {},
                        },
                      ],
                    },
                    imageSize: "contain",
                    isFormula: {},
                    minHeight: 0,
                    textColor: "#ffffff",
                    widthUnit: "px",
                    heightUnit: "px",
                    customClass: "pubwarn",
                    htmlElement: "div",
                    showForRole: [],
                    gradEndColor: "#88ff88",
                    setTextColor: false,
                    fullPageWidth: false,
                    gradDirection: "0",
                    minHeightUnit: "px",
                    showIfFormula,
                    gradStartColor: "#ff8888",
                    maxScreenWidth: "",
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
                icon: "",
                type: "blank",
                block: false,
                style: {},
                inline: false,
                contents: "Pages",
                labelFor: "sequel_to",
                isFormula: {},
                textStyle: "",
              },
              {
                above: [
                  {
                    type: "field",
                    block: false,
                    fieldview: "edit",
                    textStyle: "",
                    field_name: "pages",
                    configuration: {
                      where: "publisher == $publisher",
                    },
                  },
                  {
                    type: "field",
                    block: false,
                    fieldview: "show",
                    textStyle: "",
                    field_name: "pagesp1",
                    configuration: {
                      input_type: "text",
                    },
                  },
                ],
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
          type: "JoinField",
          block: false,
          fieldview: "as_text",
          textStyle: "",
          join_field: "publisher.name",
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
          type: "Field",
          block: false,
          fieldview: "edit",
          textStyle: "",
          field_name: "pages",
          configuration: {
            where: "publisher == $publisher",
          },
        },
        {
          type: "Field",
          block: false,
          fieldview: "show",
          textStyle: "",
          field_name: "pagesp1",
          configuration: {
            input_type: "text",
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
};

const newEvent = (dom, type) =>
  new dom.window.CustomEvent(type, {
    bubbles: true,
    cancelable: true,
  });

describe("JSDOM-E2E edit test", () => {
  it("join select should set dynamic where and show if with joinfield", async () => {
    await makeJoinSelectView({
      name: "AuthorEditForTest",
      showIfFormula: 'publisher?.name == "AK Press"',
    });
    const dom = await load_url_dom("/view/AuthorEditForTest");
    await sleep(1000);
    const pubwarn = dom.window.document.querySelector("div.pubwarn");
    //console.log(dom.serialize());
    expect(pubwarn.style.display).toBe("none");

    const select_seq = dom.window.document.querySelector(
      "select[name=sequel_to]"
    );
    expect([...select_seq.options].map((o) => o.text)).toStrictEqual([
      "",
      "Herman Melville",
    ]);
    const select = dom.window.document.querySelector("select[name=publisher]");
    select.value = "1";
    select.dispatchEvent(newEvent(dom, "change"));

    await sleep(2000);
    expect([...select_seq.options].map((o) => o.text)).toStrictEqual([
      "",
      "Leo Tolstoy",
      "Peter Kropotkin",
    ]);

    expect(pubwarn.style.display).toBe("");

    const jf = dom.window.document.querySelector(
      "div.pubwarn div[data-source-url]"
    );
    expect(jf.innerHTML).toBe("AK Press");
  });
  it("join select should set dynamic where and show if with no joinfield", async () => {
    await makeJoinSelectView({
      name: "AuthorEditForTest1",
      showIfFormula: "publisher == 1",
    });
    const dom = await load_url_dom("/view/AuthorEditForTest1");
    await sleep(1000);
    const pubwarn = dom.window.document.querySelector("div.pubwarn");

    expect(pubwarn.style.display).toBe("none");

    const select_seq = dom.window.document.querySelector(
      "select[name=sequel_to]"
    );
    expect([...select_seq.options].map((o) => o.text)).toStrictEqual([
      "",
      "Herman Melville",
    ]);
    const select = dom.window.document.querySelector("select[name=publisher]");
    select.value = "1";
    select.dispatchEvent(newEvent(dom, "change"));

    await sleep(2000);
    expect([...select_seq.options].map((o) => o.text)).toStrictEqual([
      "",
      "Leo Tolstoy",
      "Peter Kropotkin",
    ]);

    expect(pubwarn.style.display).toBe("");
  });
});
