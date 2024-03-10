const request = require("supertest");
const getApp = require("../app");
const Table = require("@saltcorn/data/models/table");
const Trigger = require("@saltcorn/data/models/trigger");

const Field = require("@saltcorn/data/models/field");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  resetToFixtures,
  respondJsonWith,
  succeedJsonWith,
  notAuthorized,
  toRedirect,
  succeedJsonWithWholeBody,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const User = require("@saltcorn/data/models/user");

beforeAll(async () => {
  await resetToFixtures();
});
afterAll(db.close);

describe("API read", () => {
  it("should get books for public simple", async () => {
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
  it("should get books for public fts", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/books/?_fts=Herman")
      .expect(
        succeedJsonWith(
          (rows) =>
            rows.length == 1 &&
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
  it("should handle fkey args ", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/patients/?favbook=1")
      .set("Cookie", loginCookie)
      .expect(succeedJsonWith((rows) => rows.length == 1));
  });
  it("should handle fkey args with no value", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/patients/?favbook=")
      .set("Cookie", loginCookie)
      .expect(succeedJsonWith((rows) => rows.length == 0));
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
  it("should dereference", async () => {
    const loginCookie = await getStaffLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/patients/?dereference=favbook")
      .set("Cookie", loginCookie)
      .expect(
        succeedJsonWith(
          (rows) =>
            rows.length == 2 &&
            rows.find((r) => r.favbook === 1).favbook_author ==
              "Herman Melville"
        )
      );
  });
  it("should add version counts", async () => {
    const patients = Table.findOne({ name: "patients" });
    await patients.update({ versioned: true });

    const loginCookie = await getStaffLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/patients/?versioncount=on")
      .set("Cookie", loginCookie)
      .expect(
        succeedJsonWith((rows) => rows.length == 2 && +rows[0]._versions === 0)
      );
  });
  it("should get distinct authors for public", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/books/distinct/author")
      .expect(
        succeedJsonWith((vals) => {
          return vals.length == 2 && vals.includes("Herman Melville");
        })
      );
  });
  it("should not allow public access to distinct patients", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/api/patients/distinct/name").expect(notAuthorized);
  });
  it("should allow staff access to distinct patients", async () => {
    const loginCookie = await getStaffLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/patients/distinct/name")
      .set("Cookie", loginCookie)
      .expect(
        succeedJsonWith(
          (rows) => rows.length == 2 && rows.includes("Kirk Douglas")
        )
      );
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
        irrelevant: "bar",
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
  it("should post with missing required fields", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/books/")
      .set("Cookie", loginCookie)
      .send({
        author: "Rosa Luxembourgh",
      })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(
        respondJsonWith(
          400,
          (resp) => resp.error && resp.error.includes("pages")
        )
      );
  });
  it("should post with invalid field", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/books/")
      .set("Cookie", loginCookie)
      .send({
        author: "Simone Weil",
        pages: -10,
      })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(
        respondJsonWith(
          400,
          (resp) => resp.error == "pages: Must be 0 or higher"
        )
      );
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
  it("should edit books with just one field", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/books/3")
      .set("Cookie", loginCookie)
      .send({
        author: "Also Engels",
        irrelevant: "foo",
      })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(succeedJsonWith((resp) => resp === true));
  });
  it("should not edit books with invalid field", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/books/3")
      .set("Cookie", loginCookie)
      .send({
        pages: -45,
      })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(
        respondJsonWith(
          400,
          (resp) => resp.error == "pages: Must be 0 or higher"
        )
      );
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

describe("API action", () => {
  it("should set up trigger", async () => {
    const table = await Table.create("triggercounter");
    await Field.create({
      table,
      name: "thing",
      label: "TheThing",
      type: "String",
    });
    await Trigger.create({
      action: "run_js_code",
      when_trigger: "API call",
      name: "mywebhook",
      min_role: 100,
      configuration: {
        code: `
        const table = Table.findOne({ name: "triggercounter" });
        await table.insertRow({ thing: row?.thing || "no body" });
        return {studio: 54}
      `,
      },
    });
  });
  it("should POST to trigger", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/action/mywebhook")
      .send({
        thing: "inthebody",
      })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(succeedJsonWithWholeBody((resp) => resp?.data?.studio === 54));
    const table = Table.findOne({ name: "triggercounter" });
    const counts = await table.getRows({});
    expect(counts.map((c) => c.thing)).toContain("inthebody");
    expect(counts.map((c) => c.thing)).not.toContain("no body");
  });
  it("should GET with query to trigger", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/action/mywebhook?thing=inthequery")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(succeedJsonWithWholeBody((resp) => resp?.data?.studio === 54));
    const table = Table.findOne({ name: "triggercounter" });
    const counts = await table.getRows({});
    expect(counts.map((c) => c.thing)).toContain("inthequery");
    expect(counts.map((c) => c.thing)).not.toContain("no body");
  });
  it("should GET to trigger", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/action/mywebhook")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(succeedJsonWithWholeBody((resp) => resp?.data?.studio === 54));
    const table = Table.findOne({ name: "triggercounter" });
    const counts = await table.getRows({});
    expect(counts.map((c) => c.thing)).toContain("no body");
  });
});
