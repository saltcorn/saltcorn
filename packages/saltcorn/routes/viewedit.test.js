const request = require("supertest");
const getApp = require("../app");
const {
  toRedirect,
  getAdminLoginCookie,
  getStaffLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude
} = require("../auth/testhelp");
const db = require("saltcorn-data/db");

afterAll(db.close);

describe("viewedit list endpoint", () => {
  itShouldRedirectUnauthToLogin("/viewedit/list");

  it("show list of views", async done => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp();
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
    const app = await getApp();
    await request(app)
      .get("/viewedit/edit/authorlist")
      .set("Cookie", loginCookie)
      .expect(toInclude("author"));
    done();
  });
});

describe("viewedit new List", () => {
  itShouldRedirectUnauthToLogin("/viewedit/new");

  it("show new view", async done => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp();
    await request(app)
      .get("/viewedit/new")
      .set("Cookie", loginCookie)
      .expect(toInclude("Template"));
    done();
  });
  it("submit new view", async done => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp();
    await request(app)
      .post("/viewedit/save")
      .send("viewtemplate=List")
      .send("table_name=books")
      .send("name=mybooklist")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit/config/mybooklist"));
    //expect(res.text.includes("View configuration")).toBe(true);
    done();
  });
  it("save new view", async done => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: 1
      })
    );
    const app = await getApp();
    await request(app)
      .post("/viewedit/config/mybooklist")
      .send("contextEnc=" + ctx)
      .send("stepName=listfields")
      .send("type_0=Field")
      .send("field_name_0=author")
      .send("type_1=Field")
      .send("field_name_1=pages")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit/list"));
    done();
  });
  it("should show new view", async done => {
    const loginCookie = await getStaffLoginCookie();

    const app = await getApp();
    await request(app)
      .get("/view/mybooklist")
      .set("Cookie", loginCookie)
      .expect(toInclude("Tolstoy"))
      .expect(toNotInclude("Kirk"));

    done();
  });

  it("delete new view", async done => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp();
    await request(app)
      .post("/viewedit/delete/mybooklist")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit/list"));
    done();
  });
});

describe("viewedit new List with one field", () => {
  it("submit new view", async done => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp();
    await request(app)
      .post("/viewedit/save")
      .send("viewtemplate=List")
      .send("table_name=books")
      .send("name=mybooklist1")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit/config/mybooklist1"));
    //expect(res.text.includes("View configuration")).toBe(true);
    done();
  });
  it("save new view", async done => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: 1
      })
    );
    const app = await getApp();
    await request(app)
      .post("/viewedit/config/mybooklist1")
      .send("contextEnc=" + ctx)
      .send("stepName=listfields")
      .send("type_0=Field")
      .send("field_name_0=author")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit/list"));
    done();
  });
  it("should show new view", async done => {
    const loginCookie = await getStaffLoginCookie();

    const app = await getApp();
    await request(app)
      .get("/view/mybooklist1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Tolstoy"))
      .expect(toNotInclude("Kirk"));

    done();
  });

  it("delete new view", async done => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp();
    await request(app)
      .post("/viewedit/delete/mybooklist1")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit/list"));
    done();
  });
});

describe("viewedit new Show", () => {
  it("submit new view", async done => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp();
    await request(app)
      .post("/viewedit/save")
      .send("viewtemplate=Show")
      .send("table_name=books")
      .send("name=mybook")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit/config/mybook"));
    //expect(res.text.includes("View configuration")).toBe(true);
    done();
  });
  it("save new view", async done => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: 1
      })
    );
    const app = await getApp();
    await request(app)
      .post("/viewedit/config/mybook")
      .send("contextEnc=" + ctx)
      .send("stepName=showfields")
      .send("type_0=Field")
      .send("field_name_0=author")
      .send("label_style=Besides")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit/list"));
    done();
  });
  it("should show new view", async done => {
    const loginCookie = await getStaffLoginCookie();

    const app = await getApp();
    await request(app)
      .get("/view/mybook?id=1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Melville"));

    done();
  });

  it("delete new view", async done => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp();
    await request(app)
      .post("/viewedit/delete/mybook")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/viewedit/list"));
    done();
  });
});
