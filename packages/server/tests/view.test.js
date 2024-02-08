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
  respondJsonWith,
  toSucceed,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");

const { plugin_with_routes } = require("@saltcorn/data/tests/mocks");

afterAll(db.close);
beforeAll(async () => {
  await resetToFixtures();
});

jest.setTimeout(30000);

describe("view list endpoint", () => {
  it("should show view to unauth", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/view/authorlist")
      .expect(toInclude("Tolstoy"))
      .expect(toNotInclude(">728<"));
  });
});
describe("nonexisting view", () => {
  itShouldRedirectUnauthToLogin("/view/patlist", "/");
});
describe("view patients list endpoint", () => {
  itShouldRedirectUnauthToLogin("/view/patientlist");

  it("should show view to staff", async () => {
    const loginCookie = await getStaffLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/view/patientlist")
      .set("Cookie", loginCookie)
      .expect(toInclude("Douglas"));
  });
});
describe("view list endpoint", () => {
  it("should show view to unauth", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/view/authorlist?pages=967")
      .expect(toInclude("Melville"))
      .expect(toNotInclude("Tolstoy"));
  });
});
describe("view list endpoint", () => {
  it("should show view to unauth", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/view/authorlist?author=Tol")
      .expect(toNotInclude("Melville"))
      .expect(toInclude("Tolstoy"));
  });
});
describe("view show endpoint", () => {
  it("should show view to unauth", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/view/authorshow?id=1")
      .expect(toInclude("Herman Melville"));
  });
});

describe("edit view", () => {
  it("should show edit", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/view/authoredit").expect(toInclude("inputauthor"));
  });
  it("should submit edit", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/view/authoredit")
      .set("Cookie", loginCookie)
      .send("author=Chekov")
      .expect(toRedirect("/view/authorlist"));
  });
});

describe("view with routes", () => {
  it("should enable", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes());
    expect(getState().viewtemplates.ViewWithRoutes.name).toBe("ViewWithRoutes");
    const table = Table.findOne({ name: "books" });

    const v = await View.create({
      table_id: table.id,
      name: "aviewwithroutes",
      viewtemplate: "ViewWithRoutes",
      configuration: {},
      min_role: 80,
    });
  });
  it("should redirect if not auth", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/view/aviewwithroutes/the_html_route")
      .expect(toRedirect("/"));
  });
  it("should redirect if view not present", async () => {
    const loginCookie = await getStaffLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/view/aviewwithrutes/the_html_route")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/"));
  });
  it("should run route", async () => {
    const loginCookie = await getStaffLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/view/aviewwithroutes/the_html_route")
      .set("Cookie", loginCookie)
      .expect(toInclude("<div>Hello</div>"));
  });
});

describe("render view on page", () => {
  it("should show edit", async () => {
    const view = await View.findOne({ name: "authorshow" });
    await View.update({ default_render_page: "a_page" }, view.id);
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/view/authorshow?id=1")
      .expect(toInclude("Bye bye"))
      .expect(toNotInclude("Herman Melville"));
  });
});

describe("render view with slug", () => {
  it("should show with id slug in list", async () => {
    const view = await View.findOne({ name: "authorshow" });
    const table = Table.findOne({ name: "books" });
    const slugOpts = await table.slug_options();
    const slugOpt = slugOpts.find((so) => so.label === "/:id");
    expect(!!slugOpt).toBe(true);
    await View.update({ default_render_page: null, slug: slugOpt }, view.id);
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/view/authorlist")
      .expect(toInclude(`/view/authorshow/1`));
    await request(app)
      .get("/view/authorshow/1")
      .expect(toInclude(`Herman Melville`));
  });
  it("should show with name slug in list", async () => {
    const view = await View.findOne({ name: "authorshow" });
    const table0 = Table.findOne({ name: "books" });
    const fields = await table0.getFields();
    const field = fields.find((f) => f.name === "author");
    await field.update({ is_unique: true });
    const table = Table.findOne({ name: "books" });

    const slugOpts = await table.slug_options();
    const slugOpt = slugOpts.find((so) => so.label === "/slugify-author");
    expect(!!slugOpt).toBe(true);
    await View.update({ default_render_page: null, slug: slugOpt }, view.id);
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/view/authorlist")
      .expect(toInclude(`/view/authorshow/herman-melville`));
    await request(app)
      .get("/view/authorshow/herman-melville")
      .expect(toInclude(`Herman Melville`));
  });
});

describe("action row_variable", () => {
  const createFilterView = async ({
    configuration,
    rowVariable,
    rndid,
    actionName,
    viewName,
    rowLimit,
  }) => {
    const table = Table.findOne({ name: "books" });
    const filterCfg = {
      layout: {
        type: "action",
        configuration: configuration,
        action_name: actionName,
        action_row_variable: rowVariable,
        action_style: "btn-primary",
        minRole: 10,
        rndid: rndid,
      },
      columns: [
        {
          type: "Action",
          action_name: actionName,
          action_row_variable: rowVariable,
          action_style: "btn-primary",
          minRole: 100,
          configuration: configuration,
          rndid: rndid,
        },
      ],
    };
    if (rowLimit) {
      filterCfg.layout.action_row_limit = rowLimit;
      filterCfg.columns[0].action_row_limit = rowLimit;
    }
    await View.create({
      table_id: table.id,
      name: viewName,
      viewtemplate: "Filter",
      configuration: filterCfg,
      min_role: 100,
    });
  };

  it("run_code_none_row_var", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await createFilterView({
      configuration: {
        run_where: "Client page",
        code: 'console.log("hello");',
      },
      rowVariable: "none",
      rndid: "q6b06q",
      actionName: "run_js_code",
      viewName: "run_code_none_row_var",
    });
    await request(app)
      .post("/view/run_code_none_row_var/run_action")
      .set("Cookie", loginCookie)
      .send({
        rndid: "q6b06q",
      })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(
        respondJsonWith(200, (resp) => {
          return (
            resp.success === "ok" && resp.eval_js === 'console.log("hello");'
          );
        })
      );
  });
  it("insert_row_from_state", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await createFilterView({
      configuration: {
        table: "books",
        row_expr: `{  
          author: row.author,
          pages: row.pages,
        }`,
      },
      rowVariable: "state",
      rndid: "u6b06u",
      actionName: "insert_any_row",
      viewName: "insert_row_from_state",
    });
    await request(app)
      .post(
        "/view/insert_row_from_state/run_action?author=author_from_state&pages=234"
      )
      .set("Cookie", loginCookie)
      .send({
        rndid: "u6b06u",
      })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(respondJsonWith(200, (resp) => resp.success === "ok"));
    const books = Table.findOne({ name: "books" });
    const actual = await books.getRows({ author: "author_from_state" });
    expect(actual.length).toBe(1);
  });
  it("run_code_eatch_matching", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await createFilterView({
      configuration: {
        run_where: "Client page",
        code: 'console.log("hello");',
      },
      rowVariable: "each_matching_row",
      rndid: "b6b06b",
      actionName: "run_js_code",
      viewName: "run_code_eatch_matching",
    });
    const testHelper = async (query, resultCount) => {
      await request(app)
        .post(`/view/run_code_eatch_matching/run_action?${query}`)
        .set("Cookie", loginCookie)
        .send({ rndid: "b6b06b" })
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .expect(
          respondJsonWith(200, (resp) => {
            if (resp.success !== "ok") return false;
            return (
              (resultCount === 0 && !resp.eval_js) ||
              (Array.isArray(resp.eval_js) &&
                resp.eval_js.length === resultCount)
            );
          })
        );
    };
    await testHelper("author=le", 2);
    await testHelper("author=Herman", 1);
    await testHelper("author=Christian", 0);
  });

  it("insert_row_each_matching", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await createFilterView({
      configuration: {
        table: "books",
        row_expr: `{  
          author: row.author + "_copy",
          pages: row.pages,
        }`,
      },
      rowVariable: "each_matching_row",
      rndid: "a6b06a",
      actionName: "insert_any_row",
      viewName: "insert_row_each_matching",
    });
    const testHelper = async (query) => {
      await request(app)
        .post(`/view/insert_row_each_matching/run_action?${query}`)
        .set("Cookie", loginCookie)
        .send({ rndid: "a6b06a" })
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .expect(
          respondJsonWith(200, (resp) => {
            return resp.success === "ok";
          })
        );
    };
    const books = Table.findOne({ name: "books" });
    let oldLength = (await books.getRows()).length;
    await testHelper("author=le");
    let newLength = (await books.getRows()).length;
    expect(newLength).toBe(oldLength + 2);
    oldLength = newLength;
    await testHelper("author=_copy");
    newLength = (await books.getRows()).length;
    expect(newLength).toBe(oldLength + 2);
    oldLength = newLength;
    await testHelper("author=Christian");
    newLength = (await books.getRows()).length;
    expect(newLength).toBe(oldLength);
  });

  it("each_matching_row: action_row_limit", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await createFilterView({
      configuration: {
        run_where: "Client page",
        code: 'console.log("hello");',
      },
      rowVariable: "each_matching_row",
      rndid: "c6b06c",
      actionName: "run_js_code",
      viewName: "author_filter_row_limit",
      rowLimit: 2,
    });
    await request(app)
      .post("/view/author_filter_row_limit/run_action?author=le")
      .set("Cookie", loginCookie)
      .send({ rndid: "c6b06c" })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(
        respondJsonWith(200, (resp) => {
          if (resp.success !== "ok") return false;
          return Array.isArray(resp.eval_js) && resp.eval_js.length === 2;
        })
      );
  });
});

describe("update matching rows", () => {
  const updateMatchingRows = async ({ query, body }) => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post(
        `/view/author_multi_edit/update_matching_rows${
          query ? `?${query}` : ""
        }`
      )
      .set("Cookie", loginCookie)
      .send(body)
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(toSucceed(302));
  };

  beforeAll(async () => {
    const table = Table.findOne({ name: "books" });
    const field = table.getFields().find((f) => f.name === "author");
    await field.update({ is_unique: false });
  });

  it("update matching books normal", async () => {
    const table = Table.findOne({ name: "books" });
    await updateMatchingRows({
      query: "author=leo&publisher=1",
      body: { author: "new_author" },
    });
    let actualRows = await table.getRows({ author: "new_author" });
    expect(actualRows.length).toBe(1);
    await updateMatchingRows({
      query: "_gte_pages=600",
      body: { author: "more_than" },
    });
    actualRows = await table.getRows({ author: "more_than" });
    expect(actualRows.length >= 2).toBe(true);
    const expected = (await table.getRows()).map((row) => {
      return { id: row.id, author: "agi", pages: 100, publisher: null };
    });
    await updateMatchingRows({
      body: { author: "agi", pages: 100, publisher: null },
    });
    actualRows = await table.getRows({});
    expect(actualRows).toEqual(expected);
  });

  it("update matching books with edit-in-edit", async () => {
    const disBooks = Table.findOne({ name: "discusses_books" });
    await updateMatchingRows({
      query: "id=2",
      body: { author: "Leo Tolstoy" },
    });
    await updateMatchingRows({
      query: "author=leo",
      body: { author: "agi", discussant_0: "1", discussant_1: "2" },
    });
    const discBooksRows = (await disBooks.getRows({ book: 2 })).filter(
      ({ discussant }) => discussant === 1 || discussant === 2
    );
    expect(discBooksRows.length).toBe(2);
  });
});

describe("inbound relations", () => {
  it("view with inbound relation", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/view/show_user_with_blog_posts_feed?id=1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Content of post APost A"))
      .expect(toInclude("Content of post BPost B"))
      .expect(toInclude("Content of post CPost C"));

    await request(app)
      .get("/view/show_user_with_blog_posts_feed?id=2")
      .set("Cookie", loginCookie)
      .expect(toNotInclude("Content of post APost A"))
      .expect(toInclude("Content of post BPost B"))
      .expect(toNotInclude("Content of post CPost C"));

    await request(app)
      .get("/view/show_user_with_blog_posts_feed?id=3")
      .set("Cookie", loginCookie)
      .expect(toInclude("Content of post APost A"))
      .expect(toInclude("Content of post BPost B"))
      .expect(toInclude("Content of post CPost C"));
  });

  it("view without inbound relation", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/view/show_user_with_independent_feed?id=1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Content of post APost A"))
      .expect(toInclude("Content of post BPost B"))
      .expect(toInclude("Content of post CPost C"));
    await request(app)
      .get("/view/show_user_with_independent_feed?id=2")
      .set("Cookie", loginCookie)
      .expect(toInclude("Content of post APost A"))
      .expect(toInclude("Content of post BPost B"))
      .expect(toInclude("Content of post CPost C"));
    await request(app)
      .get("/view/show_user_with_independent_feed?id=3")
      .set("Cookie", loginCookie)
      .expect(toInclude("Content of post APost A"))
      .expect(toInclude("Content of post BPost B"))
      .expect(toInclude("Content of post CPost C"));
  });

  it("inbound relation from query", async () => {
    const queryObj = {
      relation:
        ".users.user_interested_in_topic$user.topic.blog_in_topic$topic.post",
      srcId: 1,
    };
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();

    await request(app)
      .get(
        `/view/blog_posts_feed?_relation_path_=${encodeURIComponent(
          JSON.stringify(queryObj)
        )}`
      )
      .set("Cookie", loginCookie)
      .expect(toInclude("Content of post APost A"))
      .expect(toInclude("Content of post BPost B"))
      .expect(toInclude("Content of post CPost C"));

    queryObj.srcId = 2;
    await request(app)
      .get(
        `/view/blog_posts_feed?_relation_path_=${encodeURIComponent(
          JSON.stringify(queryObj)
        )}`
      )
      .set("Cookie", loginCookie)
      .expect(toNotInclude("Content of post APost A"))
      .expect(toInclude("Content of post BPost B"))
      .expect(toNotInclude("Content of post CPost C"));

    queryObj.srcId = 3;
    await request(app)
      .get(
        `/view/blog_posts_feed?_relation_path_=${encodeURIComponent(
          JSON.stringify(queryObj)
        )}`
      )
      .set("Cookie", loginCookie)
      .expect(toInclude("Content of post APost A"))
      .expect(toInclude("Content of post BPost B"))
      .expect(toInclude("Content of post CPost C"));
  });

  it("inbound relation with levels from query", async () => {
    const queryObj = {
      relation:
        ".users.user_interested_in_topic$user.topic.inbound_inbound$topic.bp_inbound.post",
      srcId: 1,
    };
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(
        `/view/blog_posts_feed?_relation_path_=${encodeURIComponent(
          JSON.stringify(queryObj)
        )}`
      )
      .set("Cookie", loginCookie)
      .expect(toInclude("Content of post APost A"))
      .expect(toNotInclude("Content of post BPost B"))
      .expect(toInclude("Content of post CPost C"));

    queryObj.srcId = 2;
    await request(app)
      .get(
        `/view/blog_posts_feed?_relation_path_=${encodeURIComponent(
          JSON.stringify(queryObj)
        )}`
      )
      .set("Cookie", loginCookie)
      .expect(toNotInclude("Content of post APost A"))
      .expect(toNotInclude("Content of post BPost B"))
      .expect(toNotInclude("Content of post CPost C"));
  });
});

describe("many to many relations", () => {
  it("artist_plays_on_album", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/view/show_artist?id=1")
      .set("Cookie", loginCookie)
      .expect(toInclude("album A"))
      .expect(toInclude("album B"));

    await request(app)
      .get("/view/show_artist?id=2")
      .set("Cookie", loginCookie)
      .expect(toInclude("album A"))
      .expect(toNotInclude("album B"));
  });

  it("albums feed with query", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();

    const queryObj_1 = {
      relation: ".artists.artist_plays_on_album$artist.album",
      srcId: 1,
    };
    await request(app)
      .get(
        `/view/albums_feed?_relation_path_=${encodeURIComponent(
          JSON.stringify(queryObj_1)
        )}`
      )
      .set("Cookie", loginCookie)
      .expect(toInclude("album A"))
      .expect(toInclude("album B"));

    const queryObj_2 = {
      relation: ".artists.artist_plays_on_album$artist.album",
      srcId: 2,
    };
    await request(app)
      .get(
        `/view/albums_feed?_relation_path_=${encodeURIComponent(
          JSON.stringify(queryObj_2)
        )}`
      )
      .set("Cookie", loginCookie)
      .expect(toInclude("album A"))
      .expect(toNotInclude("album B"));
  });

  it("fan_club feed with query", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();

    const queryObj_1 = {
      relation:
        ".pressing_job.album.artist_plays_on_album$album.artist.fan_club$artist",
      srcId: 1,
    };
    await request(app)
      .get(
        `/view/fan_club_feed?_relation_path_=${encodeURIComponent(
          JSON.stringify(queryObj_1)
        )}`
      )
      .set("Cookie", loginCookie)
      .expect(toInclude("crazy fan club"))
      .expect(toInclude("another club"))
      .expect(toInclude("fan club"))
      .expect(toInclude("fan club official"));

    const queryObj_2 = {
      relation:
        ".pressing_job.album.artist_plays_on_album$album.artist.fan_club$artist",
      srcId: 2,
    };
    await request(app)
      .get(
        `/view/fan_club_feed?_relation_path_=${encodeURIComponent(
          JSON.stringify(queryObj_2)
        )}`
      )
      .set("Cookie", loginCookie)
      .expect(toInclude("crazy fan club"))
      .expect(toNotInclude("another club"))
      .expect(toInclude("fan club"))
      .expect(toInclude("fan club official"));
  });
});

describe("relation path to query and state", () => {
  it("ChildList one layer", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    // my_department
    await request(app)
      .get(`/view/show_department_with_employee_list?id=1`)
      .set("Cookie", loginCookie)
      // view link
      .expect(toInclude("/view/list_employees?department=1"))
      // embedded list
      .expect(toInclude("my_department"))
      .expect(toNotInclude("department_without_employees"))
      .expect(toInclude("manager"))
      .expect(toInclude("my_employee"))
      .expect(toInclude("/view/create_employee?department=1"));

    // department_without_employees
    await request(app)
      .get(`/view/show_department_with_employee_list?id=2`)
      .set("Cookie", loginCookie)
      // view link
      .expect(toInclude("/view/list_employees?department=2"))
      // embedded list
      .expect(toNotInclude("my_department"))
      .expect(toNotInclude("department_without_employees"))
      .expect(toNotInclude("manager"))
      .expect(toNotInclude("my_employee"))
      .expect(toNotInclude("/view/create_employee?department=1"));
  });

  it("ChildList two layers", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(`/view/show_cover_with_artist_on_album?id=1`)
      .set("Cookie", loginCookie)
      // view link
      .expect(
        toInclude(
          "/view/artist_plays_on_album_list?artist_plays_on_album.album.albums.cover=1"
        )
      )
      // embedded list
      .expect(toInclude("artist A"))
      .expect(toInclude("artist B"))
      .expect(toInclude("album A"));

    await request(app)
      .get(`/view/show_cover_with_artist_on_album?id=2`)
      .set("Cookie", loginCookie)
      // view link
      .expect(
        toInclude(
          "/view/artist_plays_on_album_list?artist_plays_on_album.album.albums.cover=2"
        )
      )
      // embedded list
      .expect(toInclude("artist A"))
      .expect(toNotInclude("artist B"))
      .expect(toInclude("album B"));

    await request(app)
      .get(`/view/show_cover_with_artist_on_album?id=3`)
      .set("Cookie", loginCookie)
      // view link
      .expect(
        toInclude(
          "/view/artist_plays_on_album_list?artist_plays_on_album.album.albums.cover=3"
        )
      )
      // embedded list
      .expect(toNotInclude("artist A"))
      .expect(toNotInclude("artist B"))
      .expect(toNotInclude("album A"))
      .expect(toNotInclude("album B"));
  });

  it("OneToOneShow", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(`/view/show_cover_with_album?id=1`)
      .set("Cookie", loginCookie)
      // view link
      .expect(toInclude("/view/show_album?cover=1"))
      // embedded show
      .expect(toInclude("album A"));

    await request(app)
      .get(`/view/show_cover_with_album?id=2`)
      .set("Cookie", loginCookie)
      // view link
      .expect(toInclude("/view/show_album?cover=2"))
      // embedded show
      .expect(toInclude("blue cover"))
      .expect(toInclude("album B"));

    await request(app)
      .get(`/view/show_cover_with_album?id=3`)
      .set("Cookie", loginCookie)
      // view link
      .expect(toInclude("/view/show_album?cover=3"))
      // embedded show
      .expect(toInclude("red cover"))
      .expect(toInclude("No row selected"));
  });

  it("Own", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(`/view/show_artist_with_edit_artist?id=1`)
      .set("Cookie", loginCookie)
      // view link
      .expect(toInclude("/view/edit_artist?id=1"))
      // embedded edit
      .expect(toInclude(`value="artist A"`));

    await request(app)
      .get(`/view/show_artist_with_edit_artist?id=2`)
      .set("Cookie", loginCookie)
      // view link
      .expect(toInclude("/view/edit_artist?id=2"))
      // embedded edit
      .expect(toInclude(`value="artist B"`));
  });

  it("Parent one layer", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(`/view/show_album_with_cover?id=1`)
      .set("Cookie", loginCookie)
      // view link
      .expect(toInclude("/view/show_cover?id=1"))
      // embedded show
      .expect(toInclude("green cover"));

    await request(app)
      .get(`/view/show_album_with_cover?id=2`)
      .set("Cookie", loginCookie)
      // view link
      .expect(toInclude("/view/show_cover?id=2"))
      // embedded show
      .expect(toInclude("blue cover"));

    await request(app)
      .get(`/view/show_album_with_cover?id=3`)
      .set("Cookie", loginCookie)
      // view link
      .expect(toNotInclude("/view/show_cover?id=3"))
      // embedded show
      .expect(toInclude("No row selected"));
  });

  it("Parent two layers", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(`/view/show_patient_with_publisher?id=2`)
      .set("Cookie", loginCookie)
      // view link
      .expect(toInclude("/view/show_publisher?.patients.favbook.publisher=2"))
      // embedded show
      .expect(toInclude("Michael Douglas"))
      .expect(toInclude(["AK Press", "No row selected"]));
  });

  it("RelationPath", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(`/view/track_on_album_with_artists_on_album?id=1`)
      .set("Cookie", loginCookie)
      // view link
      .expect(
        toInclude(
          "/view/artist_plays_on_album_list?.tracks_on_album.album.artist_plays_on_album$album=1"
        )
      )
      // embedded show
      .expect(toInclude("artist A"))
      .expect(toInclude("artist B"))
      .expect(toInclude("album A"))
      .expect(toNotInclude("album B"));

    await request(app)
      .get(`/view/track_on_album_with_artists_on_album?id=2`)
      .set("Cookie", loginCookie)
      // view link
      .expect(
        toInclude(
          "/view/artist_plays_on_album_list?.tracks_on_album.album.artist_plays_on_album$album=2"
        )
      )
      // embedded show
      .expect(toInclude("artist A"))
      .expect(toNotInclude("artist B"))
      .expect(toNotInclude("album A"))
      .expect(toInclude("album B"));
  });
});

describe("edit-in-edit with relation path and legacy", () => {
  it("edit-in-edit with relation path one layer", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/view/edit_department_with_edit_in_edit_relation_path?id=1")
      .set("Cookie", loginCookie)
      .expect(toInclude("add_repeater"));
    await request(app)
      .post("/view/edit_department_with_edit_in_edit_relation_path?id=1")
      .set("Cookie", loginCookie)
      .send({
        department_0: "1",
        department_1: "1",
        id: "1",
        id_0: "1",
        id_1: "2",
        name: "my_department",
        name_0: "manager",
        name_1: "my_employee",
      })
      .expect(toRedirect("/"));
  });

  it("edit-in-edit with relation path two layer", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/view/edit_cover_with_edit_artist_on_album_rel_path?id=1")
      .set("Cookie", loginCookie)
      .expect(toInclude("add_repeater"));
    await request(app)
      .post("/view/edit_cover_with_edit_artist_on_album_rel_path?id=1")
      .set("Cookie", loginCookie)
      .send({
        album_0: "1",
        album_1: "1",
        artist_0: "1",
        artist_1: "2",
        id: "1",
        id_0: "1",
        id_1: "3",
        name: "green cover",
      })
      .expect(toRedirect("/"));
  });
  it("edit-in-edit legacy one layer", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/view/edit_department_with_edit_in_edit_legacy?id=1")
      .set("Cookie", loginCookie)
      .expect(toInclude("add_repeater"));
    await request(app)
      .post("/view/edit_department_with_edit_in_edit_legacy?id=1")
      .set("Cookie", loginCookie)
      .send({
        department_0: "1",
        department_1: "1",
        id: "1",
        id_0: "1",
        id_1: "2",
        name: "my_department",
        name_0: "manager",
        name_1: "my_employee",
      })
      .expect(toRedirect("/"));
  });

  it("edit-in-edit with relation path two layer", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/view/edit_cover_with_edit_artist_on_album_rel_path?id=1")
      .set("Cookie", loginCookie)
      .expect(toInclude("add_repeater"));
    await request(app)
      .post("/view/edit_cover_with_edit_artist_on_album_rel_path?id=1")
      .set("Cookie", loginCookie)
      .send({
        album_0: "1",
        album_1: "1",
        artist_0: "1",
        artist_1: "2",
        id: "1",
        id_0: "1",
        id_1: "3",
        name: "green cover",
      })
      .expect(toRedirect("/"));
  });

  it("edit-in-edit legacy two layer", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/view/edit_cover_with_edit_artist_on_album_legacy?id=1")
      .set("Cookie", loginCookie)
      .expect(toInclude("add_repeater"));
    await request(app)
      .post("/view/edit_cover_with_edit_artist_on_album_legacy?id=1")
      .set("Cookie", loginCookie)
      .send({
        album_0: "1",
        album_1: "1",
        artist_0: "1",
        artist_1: "2",
        id: "1",
        id_0: "1",
        id_1: "3",
        name: "green cover",
      })
      .expect(toRedirect("/"));
  });
});

describe("legacy relations with relation path", () => {
  it("Independent feed", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();

    const queryObj = {
      relation: ".",
      srcId: 1,
    };
    await request(app)
      .get(
        `/view/fan_club_feed?_relation_path_=${encodeURIComponent(
          JSON.stringify(queryObj)
        )}`
      )
      .set("Cookie", loginCookie)
      .expect(toInclude("crazy fan club"))
      .expect(toInclude("another club"))
      .expect(toInclude("fan club"))
      .expect(toInclude("fan club official"));
  });

  it("Independent feed as subview", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/view/show_pressing_job_with_new_indenpendent_relation_path?id=1")
      .set("Cookie", loginCookie)
      .expect(toInclude("crazy fan club"))
      .expect(toInclude("another club"))
      .expect(toInclude("fan club"))
      .expect(toInclude("fan club official"));
  });

  it("Own same table subview", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/view/show_album_with_subview_new_relation_path?id=1")
      .set("Cookie", loginCookie)
      .expect(toInclude("album A"));
    await request(app)
      .get("/view/show_album_with_subview_new_relation_path?id=2")
      .set("Cookie", loginCookie)
      .expect(toInclude("album B"));
  });

  it("edit-view with show-subview same table", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/view/authoredit_with_show")
      .set("Cookie", loginCookie)
      .expect(toSucceed);
    await request(app)
      .get("/view/authoredit_with_show?id=1")
      .set("Cookie", loginCookie)
      .expect(toInclude(["Herman Melville", "agi"]));
  });

  it("edit-view with independent list", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/view/authoredit_with_independent_list")
      .set("Cookie", loginCookie)
      .expect(toInclude(["Herman Melville", "agi"]))
      .expect(toInclude("Delete"));
    await request(app)
      .get("/view/authoredit_with_independent_list?id=1")
      .set("Cookie", loginCookie)
      .expect(toInclude(["Herman Melville", "agi"]))
      .expect(toInclude("Delete"));
  });
});
