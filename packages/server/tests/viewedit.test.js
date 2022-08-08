const request = require("supertest");
const getApp = require("../app");
const {
  toRedirect,
  getAdminLoginCookie,
  getStaffLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  resetToFixtures,
  succeedJsonWith,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");

beforeAll(async () => {
  await resetToFixtures();
});
afterAll(db.close);

describe("viewedit list endpoint", () => {
  itShouldRedirectUnauthToLogin("/viewedit");

  it("show list of views", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/viewedit")
      .set("Cookie", loginCookie)
      .expect(toInclude("authorlist"));
  });
});

describe("viewedit edit endpoint", () => {
  itShouldRedirectUnauthToLogin("/viewedit/edit/authorlist");

  it("show list of views", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/viewedit/edit/authorlist")
      .set("Cookie", loginCookie)
      .expect(toInclude("author"));
  });
});

describe("viewedit new List", () => {
  itShouldRedirectUnauthToLogin("/viewedit/new");

  it("show new view", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/viewedit/new")
      .set("Cookie", loginCookie)
      .expect(toInclude("Pattern"));
  });
  it("submit new view", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/viewedit/save")
      .send("viewtemplate=List")
      .send("table_name=books")
      .send("name=mybooklist")
      .send("min_role=8")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit/config/mybooklist"));
    //expect(res.text.includes("View configuration")).toBe(true);
  });
  it("save new view", async () => {
    const loginCookie = await getAdminLoginCookie();
    const table = await Table.findOne({ name: "books" });

    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: table.id,
        viewname: "mybooklist",
      })
    );
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/viewedit/config/mybooklist")
      .send("contextEnc=" + ctx)
      .send("stepName=Columns")
      .send("type_0=Field")
      .send("field_name_0=author")
      .send("type_1=Field")
      .send("field_name_1=pages")
      .send("create_view_display=Link")
      .set("Cookie", loginCookie)
      .expect(toInclude("Default state"));
  });
  it("save new views default state", async () => {
    const loginCookie = await getAdminLoginCookie();
    const table = await Table.findOne({ name: "books" });

    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: table.id,
        viewname: "mybooklist",
        columns: [
          {
            type: "Field",
            field_name: "author",
          },
          {
            type: "Field",
            field_name: "pages",
          },
        ],
      })
    );
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/viewedit/config/mybooklist")
      .send("contextEnc=" + ctx)
      .send("stepName=Default state")
      .set("Cookie", loginCookie)
      .expect(toInclude("Options"));
  });
  it("save new views options", async () => {
    const loginCookie = await getAdminLoginCookie();
    const table = await Table.findOne({ name: "books" });

    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: table.id,
        viewname: "mybooklist",
        columns: [
          {
            type: "Field",
            field_name: "author",
          },
          {
            type: "Field",
            field_name: "pages",
          },
        ],
        default_state: {},
      })
    );
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/viewedit/config/mybooklist")
      .send("contextEnc=" + ctx)
      .send("stepName=Options")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit"));
  });
  it("should show new view", async () => {
    const loginCookie = await getStaffLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/view/mybooklist")
      .set("Cookie", loginCookie)
      .expect(toInclude("Tolstoy"))
      .expect(toNotInclude("Kirk"));
  });

  it("delete new view", async () => {
    const loginCookie = await getAdminLoginCookie();
    const id = (await View.findOne({ name: "mybooklist" })).id;
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/viewedit/delete/" + id)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit"));
  });
});

describe("viewedit new List with one field", () => {
  it("submit new view", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/viewedit/save")
      .send("viewtemplate=List")
      .send("table_name=books")
      .send("name=mybooklist1")
      .send("min_role=8")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit/config/mybooklist1"));
    //expect(res.text.includes("View configuration")).toBe(true);
  });
  it("save new view", async () => {
    const loginCookie = await getAdminLoginCookie();
    const table = await Table.findOne({ name: "books" });

    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: table.id,
        viewname: "mybooklist1",
      })
    );
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/viewedit/config/mybooklist1")
      .send("contextEnc=" + ctx)
      .send("stepName=Columns")
      .send("type_0=Field")
      .send("field_name_0=author")
      .send("create_view_display=Link")
      .set("Cookie", loginCookie)
      .expect(toInclude("Default state"));
  });
  it("save new views default state", async () => {
    const loginCookie = await getAdminLoginCookie();
    const table = await Table.findOne({ name: "books" });

    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: table.id,
        viewname: "mybooklist1",
        columns: [
          {
            type: "Field",
            field_name: "author",
          },
        ],
      })
    );
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/viewedit/config/mybooklist1")
      .send("contextEnc=" + ctx)
      .send("stepName=Default state")
      .set("Cookie", loginCookie)
      .expect(toInclude("Options"));
  });
  it("save new views options", async () => {
    const loginCookie = await getAdminLoginCookie();
    const table = await Table.findOne({ name: "books" });

    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: table.id,
        viewname: "mybooklist1",
        columns: [
          {
            type: "Field",
            field_name: "author",
          },
        ],
        default_state: {},
      })
    );
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/viewedit/config/mybooklist1")
      .send("contextEnc=" + ctx)
      .send("stepName=Options")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit"));
  });
  it("should show new view", async () => {
    const loginCookie = await getStaffLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/view/mybooklist1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Tolstoy"))
      .expect(toNotInclude("Kirk"));
  });

  it("delete new view", async () => {
    const loginCookie = await getAdminLoginCookie();
    const id = (await View.findOne({ name: "mybooklist1" })).id;

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/viewedit/delete/" + id)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit"));
  });
});

describe("viewedit new Show", () => {
  const columns = [
    { type: "Field", field_name: "author", state_field: "on" },
    { type: "ViewLink", view: "Own:authorshow" },
    { type: "Action", action_name: "Delete" },
    {
      type: "Aggregation",
      agg_relation: "patients.favbook",
      agg_field: "name",
      stat: "Count",
    },
  ];
  const layout = {
    above: [{ type: "field", fieldview: "show", field_name: "author" }],
  };
  it("submit new view", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/viewedit/save")
      .send("viewtemplate=Show")
      .send("table_name=books")
      .send("name=mybook")
      .send("min_role=8")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit/config/mybook"));
    //expect(res.text.includes("View configuration")).toBe(true);
  });
  it("save new view layout", async () => {
    const loginCookie = await getAdminLoginCookie();
    const table = await Table.findOne({ name: "books" });

    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: table.id,
        viewname: "mybook",
      })
    );

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/viewedit/config/mybook")
      .send("contextEnc=" + ctx)
      .send("stepName=Layout")
      .send("columns=" + encodeURIComponent(JSON.stringify(columns)))
      .send("layout=" + encodeURIComponent(JSON.stringify(layout)))
      .set("Cookie", loginCookie)
      .expect(toInclude("Set page title"));
  });
  it("save new view page title", async () => {
    const loginCookie = await getAdminLoginCookie();
    const table = await Table.findOne({ name: "books" });

    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: table.id,
        viewname: "mybook",
        layout,
        columns,
      })
    );

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/viewedit/config/mybook")
      .send("contextEnc=" + ctx)
      .send("stepName=Set+page+title")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit"));
  });
  it("should show new view", async () => {
    const loginCookie = await getStaffLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/view/mybook?id=1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Melville"));
  });

  it("delete new view", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    const id = (await View.findOne({ name: "mybook" })).id;

    await request(app)
      .post("/viewedit/delete/" + id)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit"));
  });
});
describe("Library", () => {
  it("should save new from builder", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/library/savefrombuilder/")
      .set("Cookie", loginCookie)
      .send({
        layout: {
          columns: [],
          layout: {
            type: "card",
            contents: {
              above: [
                null,
                {
                  besides: [
                    {
                      above: [
                        null,
                        {
                          type: "blank",
                          contents: "Hello world",
                          block: false,
                          inline: false,
                          textStyle: "",
                          isFormula: {},
                          labelFor: "",
                          style: {},
                          font: "",
                        },
                      ],
                    },
                    {
                      above: [
                        null,
                        {
                          type: "blank",
                          contents: "Bye bye",
                          block: false,
                          inline: false,
                          textStyle: "",
                          isFormula: {},
                          labelFor: "",
                          style: {},
                          font: "",
                        },
                      ],
                    },
                  ],
                  breakpoints: ["", ""],
                  style: {},
                  widths: [6, 6],
                },
              ],
            },
            title: "header",
            style: {},
          },
        },
        icon: "far fa-angry",
        name: "ShinyCard",
      })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(succeedJsonWith(() => true));
  });
  it("shows library with item", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/library/list")
      .set("Cookie", loginCookie)
      .expect(toInclude("ShinyCard"));
  });
  it("deletes in library", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/library/delete/1")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/library/list"));
  });
  it("shows empty library", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/library/list")
      .set("Cookie", loginCookie)
      .expect(toInclude("Library"))
      .expect(toNotInclude("ShinyCard"))
  });
});
