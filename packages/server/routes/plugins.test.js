const request = require("supertest");
const getApp = require("../app");
const Table = require("@saltcorn/data/models/table");

const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  toRedirect
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");

afterAll(db.close);

jest.setTimeout(10000);

describe("Plugin Endpoints", () => {
  it("should show list", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp();
    await request(app)
      .get("/plugins")
      .set("Cookie", loginCookie)
      .expect(toInclude("Available plugins"));
  });

  it("should show new", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp();
    await request(app)
      .get("/plugins/new")
      .set("Cookie", loginCookie)
      .expect(toInclude("New Plugin"));
  });

  it("should show edit existing", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp();
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

    const app = await getApp();
    await request(app)
      .get("/packs/create/")
      .set("Cookie", loginCookie)
      .expect(toInclude("Create Pack"));
  });

  it("should show get install", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp();
    await request(app)
      .get("/packs/install/")
      .set("Cookie", loginCookie)
      .expect(toInclude("Install Pack"));
  });
  it("should install named", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp();
    await request(app)
      .post("/packs/install-named/Project%20management")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/"));
  });

  itShouldRedirectUnauthToLogin("/plugins/create");
  itShouldRedirectUnauthToLogin("/plugins/install");
});
