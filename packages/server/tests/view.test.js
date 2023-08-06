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
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");
const EventLog = require("@saltcorn/data/models/eventlog");
const { plugin_with_routes, sleep } = require("@saltcorn/data/tests/mocks");

afterAll(db.close);
beforeAll(async () => {
  await resetToFixtures();
});

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
    View.update({ default_render_page: "a_page" }, view.id);
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
    View.update({ default_render_page: null, slug: slugOpt }, view.id);
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
    View.update({ default_render_page: null, slug: slugOpt }, view.id);
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/view/authorlist")
      .expect(toInclude(`/view/authorshow/herman-melville`));
    await request(app)
      .get("/view/authorshow/herman-melville")
      .expect(toInclude(`Herman Melville`));
  });
});

describe("view load trigger", () => {
  beforeAll(async () => {
    await getState().setConfig("event_log_settings", {
      PageLoad: true,
    });
  });
  afterAll(async () => {
    await getState().setConfig("event_log_settings", {
      PageLoad: false,
    });
  });

  it("load view", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await EventLog.clear();
    await request(app).get("/view/authorlist").set("Cookie", loginCookie);
    // for setTimeout in emitEvent
    await sleep(1000);
    const events = await EventLog.find({ event_type: "PageLoad" });
    expect(events.length).toBe(1);
    expect(events[0].payload.type).toBe("view");
    expect(events[0].payload.name).toBe("authorlist");
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
        `/view/blog_posts_feed?_inbound_relation_path_=${encodeURIComponent(
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
        `/view/blog_posts_feed?_inbound_relation_path_=${encodeURIComponent(
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
        `/view/blog_posts_feed?_inbound_relation_path_=${encodeURIComponent(
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
        `/view/blog_posts_feed?_inbound_relation_path_=${encodeURIComponent(
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
        `/view/blog_posts_feed?_inbound_relation_path_=${encodeURIComponent(
          JSON.stringify(queryObj)
        )}`
      )
      .set("Cookie", loginCookie)
      .expect(toNotInclude("Content of post APost A"))
      .expect(toNotInclude("Content of post BPost B"))
      .expect(toNotInclude("Content of post CPost C"));
  });
});
