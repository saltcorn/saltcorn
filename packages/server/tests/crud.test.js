const request = require("supertest");
const getApp = require("../app");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  toRedirect,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  resetToFixtures
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const Table = require("@saltcorn/data/models/table");

beforeAll(async () => {
  await resetToFixtures();
});
afterAll(db.close);

describe("standard edit form", () => {
  itShouldRedirectUnauthToLogin("/edit/books");
  it("show form for new entry", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/edit/books")
      .set("Cookie", loginCookie)
      .expect(toInclude("Author"));
  });

  it("show form for existing entry", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/edit/books/1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Author"))
      .expect(toInclude("Melville"));
  });

  it("post form for new entry", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
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
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/list/books")
      .set("Cookie", loginCookie)
      .expect(toInclude("Author"))
      .expect(toInclude("Cervantes"));
  });

  it("should delete", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
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
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/")
      .expect(toInclude("authorlist"));
  });
  it("shows to admin", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/")
      .set("Cookie", loginCookie)
      .expect(toInclude("authorlist"));
  });
  it("shows redirect to admin", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
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

describe("bool toggle", () => {
  it("should toggle", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post(`/edit/toggle/readings/1/normalised`)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/list/readings"));
  });
});

describe("history", () => {
  it("should enable history", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post(`/table`)
      .set("Cookie", loginCookie)
      .send("id=1")
      .send("versioned=on")
      .expect(toRedirect("/table/1"));
    const table = await Table.findOne({ name: "books" });
    expect(table.versioned).toBe(true)    
  });
  it("create new row in versioned table", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/edit/books")
      .send("author=Caesar")
      .send("pages=178")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/list/books"));
  });
  it("edit row in versioned table", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    const table = await Table.findOne({ name: "books" });
    const tolstoy = await table.getRow({author: "Leo Tolstoy"})
    await request(app)
      .post("/edit/books")
      .send("author=Leo%20Tolstoy")
      .send("pages=729")
      .send("id="+tolstoy.id)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/list/books"));
  });
  it("edit row in versioned table again", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    const table = await Table.findOne({ name: "books" });
    const tolstoy = await table.getRow({author: "Leo Tolstoy"})
    await request(app)
      .post("/edit/books")
      .send("author=Leo%20Tolstoy")
      .send("pages=730")
      .send("id="+tolstoy.id)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/list/books"));
  });
    it("show list", async () => {
      const loginCookie = await getAdminLoginCookie();
      const app = await getApp({ disableCsrf: true });
      await request(app)
        .get("/list/books")
        .set("Cookie", loginCookie)
        .expect(toInclude("/list/_versions/"))
        .expect(toInclude("730"))
        .expect(toNotInclude("729"))
  })
  it("show versions", async () => {
    const loginCookie = await getAdminLoginCookie();
    const table = await Table.findOne({ name: "books" });
    const tolstoy = await table.getRow({author: "Leo Tolstoy"})
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/list/_versions/books/"+tolstoy.id)
      .set("Cookie", loginCookie)
      .expect(toInclude("729"))
      .expect(toInclude("730"))
      .expect(toNotInclude("728"))
      .expect(toInclude("Leo Tolstoy"))
})
it("restores old version", async () => {
  const loginCookie = await getAdminLoginCookie();
  const table = await Table.findOne({ name: "books" });
  const tolstoy = await table.getRow({author: "Leo Tolstoy"})
  const app = await getApp({ disableCsrf: true });
  await request(app)
    .post(`/list/_restore/books/${tolstoy.id}/1`)
    .set("Cookie", loginCookie)
    
})
it("show list with restored version", async () => {
  const loginCookie = await getAdminLoginCookie();
  const app = await getApp({ disableCsrf: true });
  await request(app)
    .get("/list/books")
    .set("Cookie", loginCookie)
    .expect(toInclude("/list/_versions/"))
    .expect(toInclude("729"))
    .expect(toNotInclude("730"))
})

})