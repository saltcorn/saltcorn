const request = require("supertest");
const getApp = require("../app");
const Table = require("@saltcorn/data/models/table");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  resetToFixtures,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");

beforeAll(async () => {
  await resetToFixtures();
});
afterAll(db.close);

const succeedJsonWith = (pred) => (res) => {
  if (res.statusCode !== 200) {
    console.log(res.text);
    throw new Error(`Expected status 200, received ${res.statusCode}`);
  }

  if (!pred(res.body.success)) {
    console.log(res.body);
    throw new Error(`Not satisfied`);
  }
};

const notAuthorized = (res) => {
  if (res.statusCode !== 401) {
    console.log(res.text);
    throw new Error(`Expected status 401, received ${res.statusCode}`);
  }
};

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
