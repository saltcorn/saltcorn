const request = require("supertest");
const getApp = require("../app");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  toRedirect,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");

afterAll(db.close);

describe("standard edit form", () => {
  itShouldRedirectUnauthToLogin("/edit/books");
  it("show form for new entry", async () => {
    const app = await getApp({disableCsrf: true});
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/edit/books")
      .set("Cookie", loginCookie)
      .expect(toInclude("Author"));
  });

  it("show form for existing entry", async () => {
    const loginCookie = await getStaffLoginCookie();
    const app = await getApp({disableCsrf: true});
    await request(app)
      .get("/edit/books/1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Author"))
      .expect(toInclude("Melville"));
  });

  it("post form for new entry", async () => {
    const loginCookie = await getStaffLoginCookie();
    const app = await getApp({disableCsrf: true});
    await request(app)
      .post("/edit/books")
      .send("author=Cervantes")
      .send("pages=852")
      .send("Publisher=Penguin") //sometimes needed in async tests
      .send("AgeRating=12") //ditto

      .set("Cookie", loginCookie)
      .expect(toRedirect("/list/books"));
    //if(res.statusCode===200) console.log(res.text)
    //expect(res.statusCode).toEqual(302);
  });

  itShouldRedirectUnauthToLogin("/list/books");
  it("show list", async () => {
    const loginCookie = await getStaffLoginCookie();
    const app = await getApp({disableCsrf: true});
    await request(app)
      .get("/list/books")
      .set("Cookie", loginCookie)
      .expect(toInclude("Author"))
      .expect(toInclude("Cervantes"));
  });

  it("should delete", async () => {
    const loginCookie = await getStaffLoginCookie();
    const app = await getApp({disableCsrf: true});
    await request(app)
      .post("/delete/books/3")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/list/books"));

    await request(app)
      .get("/list/books")
      .set("Cookie", loginCookie)
      .expect(toInclude("Author"))
      .expect(toNotInclude("Cervantes"));
  });
  
});

describe("homepage", () => {
  it("shows to public", async () => {
    const app = await getApp({disableCsrf: true});
    await request(app)
      .get("/")
      .expect(toInclude("authorlist"));
  });
  it("shows to admin", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({disableCsrf: true});
    await request(app)
      .get("/")
      .set("Cookie", loginCookie)
      .expect(toInclude("authorlist"));
  });
  it("shows redirect to admin", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({disableCsrf: true});
    await request(app)
      .post("/config/edit/public_home")
      .send("public_home=/view/authorlist")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/config/"));

    await request(app)
      .get("/")
      .expect(toRedirect("/view/authorlist"));
    await request(app)
      .post("/config/delete/public_home")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/config/"));
  });
});
