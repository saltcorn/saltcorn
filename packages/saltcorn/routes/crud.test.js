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
    if (res.statusCode !== 200) console.log(res.text);
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

  it("post form for new entry", async done => {
    const loginCookie = await getStaffLoginCookie();
    const res = await request(app)
      .post("/edit/books")
      .send("author=Cervantes")
      .send("pages=852")
      .send("Publisher=Penguin") //sometimes needed in async tests
      .send("AgeRating=12") //ditto

      .set("Cookie", loginCookie)
      .expect(302)
      .expect("Location", "/list/books");
    //if(res.statusCode===200) console.log(res.text)
    //expect(res.statusCode).toEqual(302);

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

describe("delete", () => {
  it("should delete", async done => {
    const loginCookie = await getStaffLoginCookie();
    const res = await request(app)
      .post("/delete/books/3")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(302);

    const res1 = await request(app)
      .get("/list/books")
      .set("Cookie", loginCookie);
    expect(res1.statusCode).toEqual(200);
    expect(res1.text.includes("Author")).toBe(true);
    expect(res1.text.includes("Cervantes")).toBe(false);

    done();
  });
});
