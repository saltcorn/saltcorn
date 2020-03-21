const request = require("supertest");
const app = require("../app");
const {
  toRedirect,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude
} = require("../auth/testhelp");

describe("root endpoint", () => {
  it("renders", async done => {
    await request(app)
      .get("/")
      .expect(200);

    done();
  });
});
describe("view list endpoint", () => {
  it("should show view to unauth TODO public vs private views", async done => {
    await request(app)
      .get("/view/authorlist")
      .expect(toInclude("Tolstoy"))
      .expect(toNotInclude("728"));

    done();
  });
});
describe("view list endpoint", () => {
  it("should show view to unauth TODO public vs private views", async done => {
    await request(app)
      .get("/view/authorlist?pages=967")
      .expect(toInclude("Melville"))
      .expect(toNotInclude("Tolstoy"));

    done();
  });
});
describe("view show endpoint", () => {
  it("should show view to unauth TODO public vs private views", async done => {
    await request(app)
      .get("/view/authorshow?id=1")
      .expect(toInclude("Herman Melville"));

    done();
  });
});
describe("viewedit list endpoint", () => {
  itShouldRedirectUnauthToLogin("/viewedit/list");

  it("show list of views", async done => {
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/viewedit/list")
      .set("Cookie", loginCookie)
      .expect(toInclude("authorlist"));
    done();
  });
});

describe("viewedit edit endpoint", () => {
  itShouldRedirectUnauthToLogin("/viewedit/edit/authorlist");

  it("show list of views", async done => {
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/viewedit/edit/authorlist")
      .set("Cookie", loginCookie)
      .expect(toInclude("author"));
    done();
  });
});

describe("viewedit new endpoint", () => {
  itShouldRedirectUnauthToLogin("/viewedit/new");

  it("show new view", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .get("/viewedit/new")
      .set("Cookie", loginCookie)
      .expect(toInclude("Template"));
    done();
  });
  it("submit new view", async done => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(JSON.stringify({}));

    await request(app)
      .post("/viewedit/")
      .send("viewtemplate=list")
      .send("contextEnc=" + ctx)
      .send("table_name=books")
      .send("name=mybooklist")
      .send("stepName=view")
      .set("Cookie", loginCookie)
      .expect(200);
    //expect(res.text.includes("View configuration")).toBe(true);
    done();
  });
  it("save new view", async done => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(
      JSON.stringify({
        table_name: "books",
        name: "mybooklist",
        viewtemplate: "list",
        is_public: false,
        on_menu: false,
        on_root_page: false
      })
    );

    await request(app)
      .post("/viewedit/")
      .send("contextEnc=" + ctx)
      .send("stepName=config")
      .send("field_list=author")
      .send("field_list=pages")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit/list"));
    done();
  });
  it("delete new view", async done => {
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/viewedit/delete/mybooklist")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit/list"));
    done();
  });
});
