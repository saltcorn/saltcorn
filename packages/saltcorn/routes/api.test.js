const request = require("supertest");
const getApp = require("../app");
const Table = require("@saltcorn/data/models/table");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");

afterAll(db.close);

const succeedJsonWith = pred => res => {
  if (res.statusCode !== 200) {
    console.log(res.text);
    throw new Error(`Expected status 200, received ${res.statusCode}`);
  }

  if (!pred(res.body.success)) {
    console.log(res.body);
    throw new Error(`Not satisfied`);
  }
};

const notAuthorized = res => {
  if (res.statusCode !== 401) {
    console.log(res.text);
    throw new Error(`Expected status 401, received ${res.statusCode}`);
  }
};

describe("API Endpoints", () => {
  it("should get books for public", async () => {
    const app = await getApp();
    await request(app)
      .get("/api/books/")
      .expect(succeedJsonWith(rows => rows.length == 2));

    //expect(res.statusCode).toEqual(302);
  });
  it("should not allow public access to patients", async () => {
    const app = await getApp();
    await request(app)
      .get("/api/patients/")
      .expect(notAuthorized);

    //expect(res.statusCode).toEqual(302);
  });
  it("should allow staff access to patients", async () => {
    const loginCookie = await getStaffLoginCookie();

    const app = await getApp();
    await request(app)
      .get("/api/patients/")
      .set("Cookie", loginCookie)
      .expect(succeedJsonWith(rows => rows.length == 2));

    //expect(res.statusCode).toEqual(302);
  });
});
