const request = require("supertest");
const app = require("../app");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin
} = require("../auth/testhelp");

describe("standard edit form", () => {
  itShouldRedirectUnauthToLogin("/edit/books");
  it("show form for new entry", async done => {
    const loginCookie = await getStaffLoginCookie();
    const res = await request(app)
      .get("/edit/books")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);
    expect(res.text.includes("Author")).toBe(true);
    done();
  });

  it("show form for existing entry", async done => {
    const loginCookie = await getStaffLoginCookie();
    const res = await request(app)
      .get("/edit/books/1")
      .set("Cookie", loginCookie)
      .expect(200);
    expect(res.statusCode).toEqual(200);
    expect(res.text.includes("Author")).toBe(true);
    expect(res.text.includes("Melville")).toBe(true);
    done();
  });

  it("show form for existing entry", async done => {
    const loginCookie = await getStaffLoginCookie();
    const res = await request(app)
      .post("/edit/books")
      .send("author=Cervantes")
      .send("pages=852")

      .set("Cookie", loginCookie)
      .expect(302);
    //.expect("Location", "/list/books");;

    done();
  });
});

describe("standard list", () => {
  itShouldRedirectUnauthToLogin("/list/books");
  it("show list", async done => {
    const loginCookie = await getStaffLoginCookie();
    const res = await request(app)
      .get("/list/books")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);
    expect(res.text.includes("Author")).toBe(true);
    expect(res.text.includes("Cervantes")).toBe(true);

    done();
  });
});
