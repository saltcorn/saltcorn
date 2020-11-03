const request = require("supertest");
const getApp = require("../app");
const Table = require("@saltcorn/data/models/table");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  resetToFixtures,
  succeedJsonWith,
  notAuthorized,
  toRedirect,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const User = require("@saltcorn/data/models/user");

beforeAll(async () => {
  await resetToFixtures();
});
afterAll(db.close);

describe("API read", () => {
  it("should get books for public", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/books/")
      .expect(
        succeedJsonWith(
          (rows) =>
            rows.length == 2 &&
            rows[0].author === "Herman Melville" &&
            rows[0].pages === 967
        )
      );
  });
  it("should get books for public with only some fields", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/books/?fields=author")
      .expect(
        succeedJsonWith(
          (rows) =>
            rows.length == 2 &&
            rows[0].author === "Herman Melville" &&
            !rows[0].pages
        )
      );
  });
  it("should get books for public with two fields", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/books/?fields=author%2Cpages")
      .expect(
        succeedJsonWith(
          (rows) =>
            rows.length == 2 &&
            rows[0].author === "Herman Melville" &&
            rows[0].pages
        )
      );
  });
  it("should get books for public with search", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/books/?pages=967")
      .expect(
        succeedJsonWith(
          (rows) =>
            rows.length == 1 &&
            rows[0].author === "Herman Melville" &&
            rows[0].pages === 967
        )
      );
  });
  it("should get books for public with search and one field", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/books/?fields=author&pages=967")
      .expect(
        succeedJsonWith(
          (rows) =>
            rows.length == 1 &&
            rows[0].author === "Herman Melville" &&
            !rows[0].pages
        )
      );
  });
  it("should not allow public access to patients", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/api/patients/").expect(notAuthorized);
  });
  it("should allow staff access to patients", async () => {
    const loginCookie = await getStaffLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/patients/")
      .set("Cookie", loginCookie)
      .expect(succeedJsonWith((rows) => rows.length == 2));
  });
});
describe("API post", () => {
  it("should post books", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/books/")
      .set("Cookie", loginCookie)
      .send({
        author: "Karl Marx",
        pages: 1285,
      })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(succeedJsonWith((resp) => resp && typeof resp === "number"));
  });
  it("should not post books as staff", async () => {
    const loginCookie = await getStaffLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/books/")
      .set("Cookie", loginCookie)
      .send({
        author: "Karl Marx",
        pages: 1285,
      })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(notAuthorized);
  });
  it("should edit books", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/books/3")
      .set("Cookie", loginCookie)
      .send({
        author: "Karl Marx",
        pages: 1286,
      })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(succeedJsonWith((resp) => resp === true));
  });
  it("should delete books", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .delete("/api/books/3")
      .set("Cookie", loginCookie)

      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(succeedJsonWith((resp) => resp === true));
  });
});
describe("API authentication", () => {
  it("should generate token", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/useradmin/gen-api-token/1")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/useradmin/1"));
    const u = await User.findOne({ id: 1 });
    expect(!!u.api_token).toBe(true);
  });
  it("should allow access to patients with query string ", async () => {
    const app = await getApp();
    const u = await User.findOne({ id: 1 });
    const url = "/api/patients/?access_token=" + u.api_token;
    await request(app)
      .get(url)
      .expect(succeedJsonWith((rows) => rows.length == 2));
  });
  it("should allow access to patients with bearer token", async () => {
    const app = await getApp();
    const u = await User.findOne({ id: 1 });
    const url = "/api/patients/";
    await request(app)
      .get(url)
      .set("Authorization", "Bearer " + u.api_token)

      .expect(succeedJsonWith((rows) => rows.length == 2));
  });
});
