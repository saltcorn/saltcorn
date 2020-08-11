const request = require("supertest");
const getApp = require("../app");
const Table = require("@saltcorn/data/models/table");

const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  toRedirect,
  resetToFixtures
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
beforeAll(async () => {
  await resetToFixtures();
});
afterAll(db.close);

jest.setTimeout(30000);

describe("Plugin Endpoints", () => {
  it("should show list", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/plugins")
      .set("Cookie", loginCookie)
      .expect(toInclude("Available plugins"));
  });

  it("should show new", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/plugins/new")
      .set("Cookie", loginCookie)
      .expect(toInclude("New Plugin"));
  });

  it("should show edit existing", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/plugins/1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Edit Plugin"));
  });

  itShouldRedirectUnauthToLogin("/plugins");
  itShouldRedirectUnauthToLogin("/plugins/new");
  itShouldRedirectUnauthToLogin("/plugins/1");
});

describe("Pack Endpoints", () => {
  it("should show get create", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/packs/create/")
      .set("Cookie", loginCookie)
      .expect(toInclude("Create Pack"));
  });

  it("should show get install", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/packs/install/")
      .set("Cookie", loginCookie)
      .expect(toInclude("Install Pack"));
  });
  it("should install named", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/packs/install-named/Project%20management")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/"));
  });

  itShouldRedirectUnauthToLogin("/plugins/create");
  itShouldRedirectUnauthToLogin("/plugins/install");
});

describe("Pack clash detection", () => {
  it("should reset", async () => {
    await resetToFixtures();
  });
  it("should install issues", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/packs/install-named/Issue%20%20tracker")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/"));
  });
  it("should install issues", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/packs/install-named/Blog")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/plugins"));
    await request(app)
      .get("/plugins")
      .set("Cookie", loginCookie)
      .expect(toInclude("Tables already exist: comments"));
  });
  it("should reset again", async () => {
    await resetToFixtures();
  });
});
describe("config endpoints", () => {
  itShouldRedirectUnauthToLogin("/config");
  it("should show get list", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/config/")
      .set("Cookie", loginCookie)
      .expect(toInclude("Allow signups"));
  });

  it("should show get form", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/config/edit/site_name")
      .set("Cookie", loginCookie)
      .expect(toInclude("<form"));
  });
  it("should show post form", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/config/edit/site_name")
      .send("site_name=FooSiteName")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/config/"));
    await request(app)
      .get("/config/")
      .set("Cookie", loginCookie)
      .expect(toInclude(">FooSiteName<"));
    await request(app)
      .post("/config/delete/site_name")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/config/"));
    await request(app)
      .get("/config/")
      .set("Cookie", loginCookie)
      .expect(toNotInclude("FooSiteName"));
  });
});
