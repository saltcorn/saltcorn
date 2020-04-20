const request = require("supertest");
const getApp = require("../app");
const {
  getStaffLoginCookie,
  toRedirect,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude
} = require("../auth/testhelp");

describe("standard edit form", () => {
  itShouldRedirectUnauthToLogin("/edit/books");
  it("show form for new entry", async done => {
    const app = await getApp();
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/edit/books")
      .set("Cookie", loginCookie)
      .expect(toInclude("Author"));
    done();
  });

  it("show form for existing entry", async done => {
    const loginCookie = await getStaffLoginCookie();
    const app = await getApp();
    await request(app)
      .get("/edit/books/1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Author"))
      .expect(toInclude("Melville"));
    done();
  });

  it("post form for new entry", async done => {
    const loginCookie = await getStaffLoginCookie();
    const app = await getApp();
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

    done();
  });

  itShouldRedirectUnauthToLogin("/list/books");
  it("show list", async done => {
    const loginCookie = await getStaffLoginCookie();
    const app = await getApp();
    await request(app)
      .get("/list/books")
      .set("Cookie", loginCookie)
      .expect(toInclude("Author"))
      .expect(toInclude("Cervantes"));

    done();
  });

  it("should delete", async done => {
    const loginCookie = await getStaffLoginCookie();
    const app = await getApp();
    await request(app)
      .post("/delete/books/3")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/list/books"));

    await request(app)
      .get("/list/books")
      .set("Cookie", loginCookie)
      .expect(toInclude("Author"))
      .expect(toNotInclude("Cervantes"));

    done();
  });
});
