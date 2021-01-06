const request = require("supertest");
const getApp = require("../app");
const {
  toRedirect,
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

const { plugin_with_routes } = require("@saltcorn/data/tests/mocks");

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
      .expect(toNotInclude("728"));
  });
});
describe("nonexisting view", () => {
  itShouldRedirectUnauthToLogin("/view/patlist", "/");
});
describe("view patients list endpoint", () => {
  itShouldRedirectUnauthToLogin("/view/patientlist", "/");

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
    await request(app)
      .post("/view/authoredit")
      .send("author=Chekov")

      .expect(toRedirect("/"));
  });
});

describe("view with routes", () => {
  it("should enable", async () => {
    getState().registerPlugin("mock_plugin", plugin_with_routes);
    expect(getState().viewtemplates.ViewWithRoutes.name).toBe("ViewWithRoutes");
    const table = await Table.findOne({ name: "books" });

    const v = await View.create({
      table_id: table.id,
      name: "aviewwithroutes",
      viewtemplate: "ViewWithRoutes",
      configuration: {},
      min_role: 8,
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
