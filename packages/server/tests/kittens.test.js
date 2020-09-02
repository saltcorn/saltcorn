const request = require("supertest");
const getApp = require("../app");
const {
  toRedirect,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  toSucceed,
  resetToFixtures,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");

afterAll(db.close);
beforeAll(async () => {
  await resetToFixtures();
});

const pack = {
  tables: [
    {
      name: "cats",
      expose_api_read: false,
      expose_api_write: false,
      min_role_read: 1,
      min_role_write: 1,
      versioned: false,
      fields: [
        {
          name: "name",
          label: "name",
          is_unique: true,
          type: "String",
          attributes: { options: "" },
          required: true,
        },
        {
          name: "stage",
          label: "stage",
          is_unique: false,
          type: "String",
          attributes: { options: "Kitten,Junior,Prime,Mature,Senior" },
          required: false,
        },
        {
          name: "lat",
          label: "lat",
          is_unique: false,
          type: "Float",
          attributes: { max: null, min: null, units: "", decimal_places: 2 },
          required: true,
        },
        {
          name: "long",
          label: "long",
          is_unique: false,
          type: "Float",
          attributes: { max: null, min: null, units: "", decimal_places: 2 },
          required: true,
        },
      ],
    },
  ],
  views: [
    {
      name: "map_no_popup",
      viewtemplate: "Leaflet map",
      configuration: {
        height: 300,
        viewname: "map_no_popup",
        popup_view: "",
        popup_width: 300,
        latitude_field: "lat",
        longtitude_field: "long",
      },
      min_role: 10,
      on_root_page: false,
      table: "cats",
    },
    {
      name: "ShowName",
      viewtemplate: "Show",
      configuration: {
        layout: {
          above: [
            { type: "blank", contents: "name" },
            { type: "line_break" },
            { type: "field", fieldview: "as_text", field_name: "name" },
            { type: "line_break" },
            { type: "blank", contents: "stage" },
            { type: "line_break" },
            { type: "field", fieldview: "as_text", field_name: "stage" },
            { type: "line_break" },
          ],
        },
        columns: [
          { type: "Field", fieldview: "as_text", field_name: "name" },
          { type: "Field", fieldview: "as_text", field_name: "stage" },
        ],
        viewname: "ShowName",
      },
      min_role: 10,
      on_root_page: false,
      table: "cats",
    },
    {
      name: "kanban_map_nopop",
      viewtemplate: "Kanban",
      configuration: {
        viewname: "kanban_map_nopop",
        show_view: "map_no_popup",
        expand_view: "",
        column_field: "stage",
        position_field: "",
        reload_on_drag: false,
        view_to_create: "",
      },
      min_role: 10,
      on_root_page: false,
      table: "cats",
    },
    {
      name: "kanban_map_pop",
      viewtemplate: "Kanban",
      configuration: {
        viewname: "kanban_map_pop",
        show_view: "map_with_popup",
        expand_view: "",
        column_field: "stage",
        position_field: "",
        reload_on_drag: false,
        view_to_create: "",
      },
      min_role: 10,
      on_root_page: false,
      table: "cats",
    },
    {
      name: "NestedShowPop",
      viewtemplate: "Show",
      configuration: {
        layout: {
          above: [
            { name: "b23a05", type: "view", view: "ShowName", state: "shared" },
            {
              name: "cb05ce",
              type: "view",
              view: "map_with_popup",
              state: "shared",
            },
          ],
        },
        columns: [],
        viewname: "NestedShow",
      },
      min_role: 10,
      on_root_page: false,
      table: "cats",
    },
    {
      name: "map_with_popup",
      viewtemplate: "Leaflet map",
      configuration: {
        height: 300,
        viewname: "map_with_popup",
        popup_view: "ShowName",
        popup_width: 50,
        latitude_field: "lat",
        longtitude_field: "long",
      },
      min_role: 10,
      on_root_page: false,
      table: "cats",
    },
    {
      name: "kanban_nested_pop",
      viewtemplate: "Kanban",
      configuration: {
        viewname: "kanban_nested_pop",
        show_view: "NestedShowPop",
        expand_view: "",
        column_field: "stage",
        position_field: "",
        reload_on_drag: false,
        view_to_create: "",
      },
      min_role: 10,
      on_root_page: false,
      table: "cats",
    },
    {
      name: "NestedShowNoPop",
      viewtemplate: "Show",
      configuration: {
        layout: {
          above: [
            { name: "34e1f0", type: "view", view: "ShowName", state: "shared" },
            {
              name: "5bb9da",
              type: "view",
              view: "map_no_popup",
              state: "shared",
            },
          ],
        },
        columns: [],
        viewname: "NestedShowNoPop",
      },
      min_role: 10,
      on_root_page: false,
      table: "cats",
    },
    {
      name: "kanban_nested_nopop",
      viewtemplate: "Kanban",
      configuration: {
        viewname: "kanban_nested_nopop",
        show_view: "NestedShowNoPop",
        expand_view: "",
        column_field: "stage",
        position_field: "",
        reload_on_drag: false,
        view_to_create: "",
      },
      min_role: 10,
      on_root_page: false,
      table: "cats",
    },
  ],
  plugins: [
    {
      name: "leaflet-map",
      source: "npm",
      location: "@saltcorn/leaflet-map",
    },
    {
      name: "kanban",
      source: "npm",
      location: "@saltcorn/kanban",
    },
  ],
  pages: [],
};

const view_should_include = (viewname, hasText) =>
  it(`should show view ${viewname} including "${hasText}"`, async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/view/" + viewname)
      .expect(toSucceed)
      .expect(toInclude(hasText));
  });

describe("Kitten tracker", () => {
  it("should install pack", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/packs/install/")
      .set("Cookie", loginCookie)
      .send(`pack=${encodeURIComponent(JSON.stringify(pack))}`)
      .expect(toRedirect("/"));
  });
  it("should insert rows", async () => {
    const tbl = await Table.findOne({ name: "cats" });
    expect(!!tbl).toBe(true);
    await tbl.insertRow({ name: "Charlie", stage: "Kitten", lat: 51, long: 0 });
    await tbl.insertRow({
      name: "Bella",
      stage: "Junior",
      lat: 51.23,
      long: 0.1,
    });
  });

  view_should_include("map_no_popup", "51.23");
  /*view_should_include("map_with_popup", "Bella");
  view_should_include("kanban_map_nopop", "51.23");
  view_should_include("kanban_map_pop", "Bella");
  view_should_include("kanban_nested_nopop", "51.23");
  view_should_include("kanban_nested_pop", "Bella");*/
});
