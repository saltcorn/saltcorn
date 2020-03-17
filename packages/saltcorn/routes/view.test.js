const request = require("supertest");
const app = require("../app");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin
} = require("../auth/testhelp");

describe("view endpoint", () => {
  it("should show view to unauth TODO public vs private views", async done => {
    const res = await request(app).get("/view/authorlist");

    expect(res.statusCode).toEqual(200);
    expect(res.text.includes("Tolstoy")).toBe(true);
    expect(res.text.includes("728")).toBe(false);

    done();
  });
});

describe("viewedit list endpoint", () => {
  itShouldRedirectUnauthToLogin("/viewedit/list");

  it("show list of views", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .get("/viewedit/list")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);
    expect(res.text.includes("authorlist")).toBe(true);
    done();
  });
});

describe("viewedit edit endpoint", () => {
  itShouldRedirectUnauthToLogin("/viewedit/edit/authorlist");

  it("show list of views", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .get("/viewedit/edit/authorlist")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);
    expect(res.text.includes("author")).toBe(true);
    done();
  });
});

describe("viewedit new endpoint", () => {
  itShouldRedirectUnauthToLogin("/viewedit/new");

  it("show new view", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .get("/viewedit/new")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);
    expect(res.text.includes("Template")).toBe(true);
    done();
  });
  it("submit new view", async done => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(JSON.stringify({}));

    const res = await request(app)
      .post("/viewedit/")
      .send("viewtemplate=list")
      .send("contextEnc=" + ctx)
      .send("table_name=books")
      .send("name=mybooklist")
      .send("stepName=view")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);
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

    const res = await request(app)
      .post("/viewedit/")
      .send("contextEnc=" + ctx)
      .send("stepName=config")
      .send("field_list=author")
      .send("field_list=pages")
      .set("Cookie", loginCookie)
      .expect(302)
      .expect("Location", "/viewedit/list");
    done();
  });
  it("delete new view", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .post("/viewedit/delete/mybooklist")
      .set("Cookie", loginCookie)
      .expect(302)
      .expect("Location", "/viewedit/list");
    done();
  });
});
