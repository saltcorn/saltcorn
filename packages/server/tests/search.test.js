import { request as request } from "../auth/testhelp.js";
import getApp from "../app.js";
import Table from "@saltcorn/data/models/table";
import {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toRedirect,
  toNotInclude,
  resetToFixtures,
} from "../auth/testhelp.js";
import db from "@saltcorn/data/db";

afterAll(db.close);

beforeAll(async () => {
  await resetToFixtures();
});

describe("Search config Endpoints", () => {
  itShouldRedirectUnauthToLogin("/search/config");

  it("should show search config form", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/search/config")
      .set("Cookie", loginCookie)
      .expect(toInclude("Result preview for books"));
  });
  it("should set search view", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/search/config/")
      .send("books=authorshow")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/search/config"));
  });
  it("should show search form", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/search").expect(toInclude("Search all tables"));
  });
  it("should show search form", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/search?q=Tolstoy").expect(toInclude("Leo"));
  });
  it("should show search form", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/search?q=Melville").expect(toNotInclude("Leo"));
  });
});
