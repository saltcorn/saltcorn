const request = require("supertest");
const getApp = require("../app");
const Table = require("@saltcorn/data/models/table");
const Trigger = require("@saltcorn/data/models/trigger");
const File = require("@saltcorn/data/models/file");
const Field = require("@saltcorn/data/models/field");
const User = require("@saltcorn/data/models/user");
const { getState } = require("@saltcorn/data/db/state");

const fs = require("fs").promises;

const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  resetToFixtures,
  respondJsonWith,
  succeedJsonWith,
  notAuthorized,
  toRedirect,
  toInclude,
  succeedJsonWithWholeBody,
  getAdminJwt,
  toSucceed,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const { sleep } = require("@saltcorn/data/tests/mocks");

beforeAll(async () => {
  await resetToFixtures();
  await File.ensure_file_store();
  await File.from_req_files(
    {
      mimetype: "image/png",
      name: "rick1.png",
      mv: async (fnm) => {
        await fs.writeFile(fnm, "nevergonnagiveyouup");
      },
      size: 245752,
    },
    1,
    80
  );
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
  it("should get books limit", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/books/?limit=1&offset=1&sortBy=pages")
      .expect(
        succeedJsonWith(
          (rows) =>
            rows.length == 1 &&
            rows[0].author === "Herman Melville" &&
            rows[0].pages === 967
        )
      );
  });
  it("should get books limit with offset 0", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/books/?limit=1&offset=0&sortBy=pages")
      .expect(succeedJsonWith((rows) => rows.length == 1));
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
describe("API count", () => {
  it("should count books for public simple", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/books/count")
      .expect(succeedJsonWith((count) => count === 2));
  });

  // it("should count books for public fts", async () => {

  it("should count books for public with search", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/books/count?pages=967")
      .expect(succeedJsonWith((count) => count === 1));
  });
  it("should count with fkey args ", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/patients/count/?favbook=1")
      .set("Cookie", loginCookie)
      .expect(succeedJsonWith((count) => count === 1));
  });
  it("should count with fkey args with no value", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/patients/count/?favbook=")
      .set("Cookie", loginCookie)
      .expect(succeedJsonWith((count) => count === 0));
  });
  it("should count books for public with search and one field", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/books/count/?fields=author&pages=967")
      .expect(succeedJsonWith((count) => count === 1));
  });
  it("should not allow public count access to patients", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/api/patients/count").expect(notAuthorized);
  });
  it("should allow staff count access to patients", async () => {
    const loginCookie = await getStaffLoginCookie();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get("/api/patients/count")
      .set("Cookie", loginCookie)
      .expect(succeedJsonWith((count) => count === 2));
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
    const tokens = await u.listApiTokens();
    expect(tokens.length).toBeGreaterThan(0);
  });
  it("should allow access to patients with query string ", async () => {
    const app = await getApp();
    const u = await User.findOne({ id: 1 });
    const tokens = await u.listApiTokens();
    const token = tokens[0] ? tokens[0].token : u.api_token;
    const url = "/api/patients/?access_token=" + token;
    await request(app)
      .get(url)
      .expect(succeedJsonWith((rows) => rows.length == 2));
  });
  it("should allow access to patients with bearer token", async () => {
    const app = await getApp();
    const u = await User.findOne({ id: 1 });
    const tokens = await u.listApiTokens();
    const token = tokens[0] ? tokens[0].token : u.api_token;
    const url = "/api/patients/";
    await request(app)
      .get(url)
      .set("Authorization", "Bearer " + token)
      .expect(succeedJsonWith((rows) => rows.length == 2));
  });
  it("should not show file to public", async () => {
    const app = await getApp();
    await request(app)
      .get("/api/serve-files/rick1.png")
      .expect(respondJsonWith(404, (b) => b.error === "Not found"));
  });
  it("should show file to user", async () => {
    const app = await getApp();
    const u = await User.findOne({ id: 1 });
    const tokens = await u.listApiTokens();
    const token = tokens[0] ? tokens[0].token : u.api_token;
    await request(app)
      .get("/api/serve-files/rick1.png")
      .set("Authorization", "Bearer " + token)
      .expect(200);
  });
  describe("action authentication", () => {
    let adminToken, staffToken;

    beforeAll(async () => {
      await Trigger.create({
        action: "run_js_code",
        when_trigger: "API call",
        name: "apicalladmin",
        min_role: 1,
        configuration: {
          code: `return {area: 1}`,
        },
      });
      await Trigger.create({
        action: "run_js_code",
        when_trigger: "API call",
        name: "apicallstaff",
        min_role: 40,
        configuration: {
          code: `return {area: 40}`,
        },
      });
      await Trigger.create({
        action: "run_js_code",
        when_trigger: "API call",
        name: "apicallpublic",
        min_role: 100,
        configuration: {
          code: `return {area: 100}`,
        },
      });

      const admin = await User.findOne({ email: "admin@foo.com" });
      const staff = await User.findOne({ email: "staff@foo.com" });
      adminToken = await admin.getNewAPIToken();
      staffToken = await staff.getNewAPIToken();
    });

    it("should POST to trigger with admin token", async () => {
      const app = await getApp({ disableCsrf: true });
      for (const { triggerName, expectedArea } of [
        { triggerName: "apicalladmin", expectedArea: 1 },
        { triggerName: "apicallstaff", expectedArea: 40 },
        { triggerName: "apicallpublic", expectedArea: 100 },
      ]) {
        await request(app)
          .post(`/api/action/${triggerName}`)
          .set("Authorization", "Bearer " + adminToken)
          .set("Content-Type", "application/json")
          .set("Accept", "application/json")
          .expect(
            succeedJsonWithWholeBody(
              (resp) =>
                resp?.data?.area === expectedArea && resp.success === true
            )
          );
      }
    });

    it("should POST to trigger with admin session", async () => {
      const app = await getApp({ disableCsrf: true });
      const loginCookie = await getAdminLoginCookie();
      for (const { triggerName, expectedArea } of [
        { triggerName: "apicalladmin", expectedArea: 1 },
        { triggerName: "apicallstaff", expectedArea: 40 },
        { triggerName: "apicallpublic", expectedArea: 100 },
      ]) {
        await request(app)
          .post(`/api/action/${triggerName}`)
          .set("Cookie", loginCookie)
          .set("Content-Type", "application/json")
          .set("Accept", "application/json")
          .expect(
            succeedJsonWithWholeBody(
              (resp) =>
                resp?.data?.area === expectedArea && resp.success === true
            )
          );
      }
    });

    it("should POST to trigger with staff token", async () => {
      const app = await getApp({ disableCsrf: true });
      for (const { triggerName, expectedArea } of [
        { triggerName: "apicallstaff", expectedArea: 40 },
        { triggerName: "apicallpublic", expectedArea: 100 },
      ]) {
        await request(app)
          .post(`/api/action/${triggerName}`)
          .set("Authorization", "Bearer " + staffToken)
          .set("Content-Type", "application/json")
          .set("Accept", "application/json")
          .expect(
            succeedJsonWithWholeBody(
              (resp) =>
                resp?.data?.area === expectedArea && resp.success === true
            )
          );
      }
    });

    it("should POST to trigger with staff session", async () => {
      const app = await getApp({ disableCsrf: true });
      const loginCookie = await getStaffLoginCookie();
      for (const { triggerName, expectedArea } of [
        { triggerName: "apicallstaff", expectedArea: 40 },
        { triggerName: "apicallpublic", expectedArea: 100 },
      ]) {
        await request(app)
          .post(`/api/action/${triggerName}`)
          .set("Cookie", loginCookie)
          .set("Content-Type", "application/json")
          .set("Accept", "application/json")
          .expect(
            succeedJsonWithWholeBody(
              (resp) =>
                resp?.data?.area === expectedArea && resp.success === true
            )
          );
      }
    });

    it("should POST to trigger as public", async () => {
      const app = await getApp({ disableCsrf: true });
      await request(app)
        .post("/api/action/apicallpublic")
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .expect(
          succeedJsonWithWholeBody(
            (resp) => resp?.data?.area === 100 && resp.success === true
          )
        );
    });

    it("should not POST to trigger with staff token", async () => {
      const app = await getApp({ disableCsrf: true });
      await request(app)
        .post("/api/action/apicalladmin")
        .set("Authorization", "Bearer " + staffToken)
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .expect(notAuthorized);
    });

    it("should not Post to trigger with staff session", async () => {
      const app = await getApp({ disableCsrf: true });
      await request(app)
        .post("/api/action/apicalladmin")
        .set("Cookie", await getStaffLoginCookie())
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .expect(notAuthorized);
    });

    it("should not POST to trigger without any authentication", async () => {
      const app = await getApp({ disableCsrf: true });
      for (const triggerName of ["apicalladmin", "apicallstaff"]) {
        await request(app)
          .post(`/api/action/${triggerName}`)
          .set("Content-Type", "application/json")
          .set("Accept", "application/json")
          .expect(notAuthorized);
      }
    });
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
    await Trigger.create({
      action: "run_js_code",
      when_trigger: "API call",
      name: "apicallraw",
      min_role: 100,
      configuration: {
        code: `return {studio: 54}`,
        _raw_output: true,
      },
    });
    await Trigger.create({
      action: "run_js_code",
      when_trigger: "API call",
      name: "apicallerror",
      min_role: 100,
      configuration: {
        code: `return {error: "bad"}`,
      },
    });
    await Trigger.create({
      action: "run_js_code",
      when_trigger: "API call",
      name: "apicallundef",
      min_role: 100,
      configuration: {
        code: `return;`,
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
      .expect(
        succeedJsonWithWholeBody(
          (resp) => resp?.data?.studio === 54 && resp.success === true
        )
      );
    const table = Table.findOne({ name: "triggercounter" });
    const counts = await table.getRows({});
    expect(counts.map((c) => c.thing)).toContain("inthebody");
    expect(counts.map((c) => c.thing)).not.toContain("no body");
  });
  it("should POST to raw trigger", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/action/apicallraw")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(succeedJsonWithWholeBody((resp) => resp?.studio === 54));
  });
  it("should POST to raw trigger", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/action/apicallerror")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(
        succeedJsonWithWholeBody(
          (resp) => resp?.error === "bad" && resp.success === false
        )
      );
  });
  it("should POST to undefiend trigger", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/action/apicallundef")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(succeedJsonWithWholeBody((resp) => resp.success === true));
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

describe("API emit", () => {
  it("emits an event via POST with JWT", async () => {
    const app = await getApp({ disableCsrf: true });
    const token = await getAdminJwt();
    await request(app)
      .post("/api/emit-event/ReceiveMobileShareData")
      .set("Authorization", `jwt ${token}`)
      .send({ payload: { latitude: 20, longitude: 30 } })
      .expect(succeedJsonWith((success) => success === true));
    await sleep(200);
  });

  it("denies an event without JWT", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/emit-event/ReceiveMobileShareData")
      .send({ payload: { latitude: 20, longitude: 30 } })
      .expect(notAuthorized);
  });
});

describe("API emit-event access control", () => {
  const getPublicJwt = async () => {
    const app = await getApp({ disableCsrf: true });
    const res = await request(app)
      .post("/auth/login-with/jwt")
      .set("X-Requested-With", "XMLHttpRequest")
      .set("X-Saltcorn-Client", "mobile-app")
      .send({});
    return res.body;
  };

  let adminJwt;
  beforeAll(async () => {
    adminJwt = await getAdminJwt();
  });

  afterEach(async () => {
    await getState().setConfig("mobile_emit_allowed_events", []);
    await getState().setConfig("mobile_emit_public_events", []);
  });

  // --- authenticated user ---

  it("allows authenticated user to emit ReceiveMobileShareData by default", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/emit-event/ReceiveMobileShareData")
      .set("Authorization", `jwt ${adminJwt}`)
      .send({ payload: {} })
      .expect(succeedJsonWith((success) => success === true));
  });

  it("blocks authenticated user from emitting other events by default", async () => {
    const app = await getApp({ disableCsrf: true });
    for (const eventName of [
      "AppChange",
      "Login",
      "Error",
      "Startup",
      "UserVerified",
    ]) {
      await request(app)
        .post(`/api/emit-event/${eventName}`)
        .set("Authorization", `jwt ${adminJwt}`)
        .send({ payload: {} })
        .expect(
          respondJsonWith(
            403,
            (resp) => resp.error === "Event type not allowed"
          )
        );
    }
  });

  it("allows authenticated user to emit event listed in mobile_emit_allowed_events config", async () => {
    await getState().setConfig("mobile_emit_allowed_events", ["AppChange"]);
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/emit-event/AppChange")
      .set("Authorization", `jwt ${adminJwt}`)
      .send({ payload: {} })
      .expect(succeedJsonWith((success) => success === true));
  });

  it("blocks authenticated user from emitting event not listed in mobile_emit_allowed_events config", async () => {
    await getState().setConfig("mobile_emit_allowed_events", ["AppChange"]);
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/emit-event/Login")
      .set("Authorization", `jwt ${adminJwt}`)
      .send({ payload: {} })
      .expect(
        respondJsonWith(403, (resp) => resp.error === "Event type not allowed")
      );
  });

  // --- public user ---

  it("blocks public JWT user from emitting any event by default", async () => {
    const publicJwt = await getPublicJwt();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/emit-event/ReceiveMobileShareData")
      .set("Authorization", `jwt ${publicJwt}`)
      .send({ payload: {} })
      .expect(notAuthorized);
  });

  it("allows public JWT user to emit event listed in mobile_emit_public_events config", async () => {
    await getState().setConfig("mobile_emit_public_events", [
      "CustomerEnquiry",
    ]);
    const publicJwt = await getPublicJwt();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/emit-event/CustomerEnquiry")
      .set("Authorization", `jwt ${publicJwt}`)
      .send({ payload: {} })
      .expect(succeedJsonWith((success) => success === true));
  });

  it("blocks public JWT user from emitting event not listed in mobile_emit_public_events config", async () => {
    await getState().setConfig("mobile_emit_public_events", [
      "CustomerEnquiry",
    ]);
    const publicJwt = await getPublicJwt();
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/emit-event/OtherEvent")
      .set("Authorization", `jwt ${publicJwt}`)
      .send({ payload: {} })
      .expect(notAuthorized);
  });

  // --- no token ---

  it("blocks request with no JWT at all", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/emit-event/ReceiveMobileShareData")
      .send({ payload: {} })
      .expect(notAuthorized);
  });
});

describe("test share handler", () => {
  beforeAll(async () => {
    const sharedData = await Table.create("shared_data");
    await Field.create({
      table: sharedData,
      name: "title",
      label: "Title",
      type: "String",
    });
    await Field.create({
      table: sharedData,
      name: "user",
      label: "user",
      type: "String",
    });
    await Trigger.create({
      action: "run_js_code",
      when_trigger: "ReceiveMobileShareData",
      name: "my_receive_share",
      min_role: 100,
      configuration: {
        code: `
        const sharedData = Table.findOne({ name: "shared_data" });
        await sharedData.insertRow({
          title: row.title, user: JSON.stringify(user)
        });`,
      },
    });
  });

  it("shares as admin", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/notifications/share-handler")
      .set("Cookie", loginCookie)
      .send({ title: "share_as_admin" })
      .expect(toRedirect("/"));
    await sleep(1000);
    const sharedData = Table.findOne({ name: "shared_data" });
    const rows = await sharedData.getRows({});
    const row = rows.find(
      (r) =>
        r.title === "share_as_admin" &&
        r.user ===
          '{"email":"admin@foo.com","id":1,"role_id":1,"language":null,"tenant":"public","lightDarkMode":"light","attributes":{}}'
    );
    expect(row).toBeDefined();
  });

  it("does not share as public", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/notifications/share-handler")
      .send({ title: "does_not_share_as_public" })
      .expect(toRedirect("/auth/login"));
    await sleep(1000);
    const sharedData = Table.findOne({ name: "shared_data" });
    const rows = await sharedData.getRows({});
    const row = rows.find((r) => r.title === "does_not_share_as_public");
    expect(row).toBeUndefined();
  });
});

describe("API upload-files", () => {
  let adminToken;
  beforeAll(async () => {
    const admin = await User.findOne({ email: "admin@foo.com" });
    adminToken = await admin.getNewAPIToken();
  });

  it("should upload file with bearer token", async () => {
    const app = await getApp({ disableCsrf: true });
    const res = await request(app)
      .post("/api/upload-files")
      .set("Authorization", "Bearer " + adminToken)
      .field("min_role_read", "80")
      .field("folder", "apitests")
      .attach("file", Buffer.from("helloiamasmallfile", "utf-8"), "file.txt")
      .expect(200);
    const body = res.body;
    expect(body.success).toBeDefined();
    expect(body.success.filename).toBe("file.txt");
    // location may have a numeric suffix if file already exists
    expect(body.success.location).toMatch(/^apitests\/file(_\d+)?\.txt$/);
    expect(body.success.url).toBe("/files/serve/" + body.success.location);
    const f = await File.findOne(body.success.location);
    expect(f).toBeDefined();
    expect(f.min_role_read).toBe(80);
    expect(f.user_id).toBe(1);
  });

  it("should not allow public upload", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/upload-files")
      .attach("file", Buffer.from("hellopublic", "utf-8"), "publicupload.txt")
      .expect(notAuthorized);
  });

  it("should reject missing file", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/upload-files")
      .set("Authorization", "Bearer " + adminToken)
      .field("min_role_read", "80")
      .expect(respondJsonWith(400, (resp) => resp.error === "No file found"));
  });
});

describe("API cross-table sub-select access control", () => {
  it("should not allow probing restricted tables via sub-select query syntax", async () => {
    const app = await getApp({ disableCsrf: true });
    // The patients table has min_role_read=40 (staff).
    // A public user should not be able to learn anything about patients data.
    // The books table is public (min_role_read=100).
    // The sub-select syntax (e.g. ?id.patients->name=Kirk) constructs:
    //   WHERE id IN (SELECT id FROM patients WHERE name ILIKE '%Kirk%')
    // This leaks whether a patient named "Kirk" exists by observing
    // whether any books are returned.
    const patients = Table.findOne({ name: "patients" });
    expect(patients.min_role_read).toBe(40);

    // Query WITH a name that exists in patients ("Kirk Douglas", id=1)
    const resp1 = await request(app)
      .get("/api/books/?id.patients->name=Kirk")
      .expect(200);

    // Query with a name that does NOT exist in patients
    const resp2 = await request(app)
      .get("/api/books/?id.patients->name=ZZZNONEXISTENT")
      .expect(200);

    // If the sub-select is allowed, resp1 returns books (because patient
    // "Kirk Douglas" has id=1 which matches book id=1) while resp2
    // returns nothing. The difference reveals that "Kirk" exists in the
    // restricted patients table.
    //
    // The secure behavior is that both queries return the same results
    // (the sub-select against a restricted table is ignored or blocked),
    // OR the query with the sub-select is rejected entirely.
    const rows1 = resp1.body.success || [];
    const rows2 = resp2.body.success || [];
    expect(rows1.length).toBe(rows2.length);
  });

  it("should not allow probing restricted tables via or parameter with inSelect", async () => {
    const app = await getApp({ disableCsrf: true });
    // The patients table has min_role_read=40 (staff).
    // The books table is public (min_role_read=100).
    //
    // The 'or' query parameter is passed directly through stateFieldsToWhere
    // into the db where-clause without access control checks. An attacker
    // can embed an inSelect subquery in 'or' to probe restricted tables:
    //   ?or[0][id][inSelect][table]=patients&or[0][id][inSelect][field]=favbook
    //    &or[0][id][inSelect][where][name]=Kirk Douglas
    // This generates: WHERE (id IN (SELECT favbook FROM patients WHERE name='Kirk Douglas'))
    // By observing which books are returned, the attacker can determine
    // whether a patient with a given name exists — leaking data from the
    // restricted patients table.
    const patients = Table.findOne({ name: "patients" });
    expect(patients.min_role_read).toBe(40);

    // Kirk Douglas exists in patients with favbook=1 (Herman Melville)
    const resp1 = await request(app)
      .get("/api/books/")
      .query({
        "or[0][id][inSelect][table]": "patients",
        "or[0][id][inSelect][field]": "favbook",
        "or[0][id][inSelect][where][name]": "Kirk Douglas",
      })
      .expect(200);

    // Non-existent patient
    const resp2 = await request(app)
      .get("/api/books/")
      .query({
        "or[0][id][inSelect][table]": "patients",
        "or[0][id][inSelect][field]": "favbook",
        "or[0][id][inSelect][where][name]": "ZZZNONEXISTENT",
      })
      .expect(200);

    // If the or+inSelect bypass works, resp1 returns only book id=1
    // (Kirk Douglas's favbook) while resp2 returns nothing.
    // Secure behavior: both return the same results (all books or error).
    const rows1 = resp1.body.success || [];
    const rows2 = resp2.body.success || [];
    expect(rows1.length).toBe(rows2.length);
  });

  it("should not allow probing restricted tables via field object with inSelect", async () => {
    const app = await getApp({ disableCsrf: true });
    // When a field value is an object, stateFieldsToWhere passes it through
    // directly. An attacker can embed inSelect in a known field name:
    //   ?id[inSelect][table]=patients&id[inSelect][field]=favbook&...
    const patients = Table.findOne({ name: "patients" });
    expect(patients.min_role_read).toBe(40);

    const resp1 = await request(app)
      .get("/api/books/")
      .query({
        "id[inSelect][table]": "patients",
        "id[inSelect][field]": "favbook",
        "id[inSelect][where][name]": "Kirk Douglas",
      })
      .expect(200);

    const resp2 = await request(app)
      .get("/api/books/")
      .query({
        "id[inSelect][table]": "patients",
        "id[inSelect][field]": "favbook",
        "id[inSelect][where][name]": "ZZZNONEXISTENT",
      })
      .expect(200);

    const rows1 = resp1.body.success || [];
    const rows2 = resp2.body.success || [];
    expect(rows1.length).toBe(rows2.length);
  });

  it("should not allow probing restricted tables via _not_ prefix with inSelect", async () => {
    const app = await getApp({ disableCsrf: true });
    // The _not_ prefix passes user values into qstate.not[field].
    // An attacker can embed inSelect to leak data:
    //   ?_not_id[inSelect][table]=patients&_not_id[inSelect][field]=favbook&...
    const patients = Table.findOne({ name: "patients" });
    expect(patients.min_role_read).toBe(40);

    const resp1 = await request(app)
      .get("/api/books/")
      .query({
        "_not_id[inSelect][table]": "patients",
        "_not_id[inSelect][field]": "favbook",
        "_not_id[inSelect][where][name]": "Kirk Douglas",
      })
      .expect(200);

    const resp2 = await request(app)
      .get("/api/books/")
      .query({
        "_not_id[inSelect][table]": "patients",
        "_not_id[inSelect][field]": "favbook",
        "_not_id[inSelect][where][name]": "ZZZNONEXISTENT",
      })
      .expect(200);

    const rows1 = resp1.body.success || [];
    const rows2 = resp2.body.success || [];
    expect(rows1.length).toBe(rows2.length);
  });

  it("should not allow probing restricted tables via _relation_path_ parameter", async () => {
    const app = await getApp({ disableCsrf: true });
    // The _relation_path_ query parameter accepts JSON that specifies a
    // relation path through arbitrary tables. handleRelationPath() constructs
    // an inSelectWithLevels subquery with NO authorization checks.
    //
    // Attack: query the public books table with a _relation_path_ that
    // traverses the restricted patients table (min_role_read=40):
    //   ?_relation_path_={"relation":".books.patients$name","srcId":"Kirk Douglas"}
    // This generates:
    //   WHERE id IN (SELECT id FROM patients WHERE name = 'Kirk Douglas')
    // A public user can determine whether a patient with a given name exists
    // by observing which books are returned.
    const patients = Table.findOne({ name: "patients" });
    expect(patients.min_role_read).toBe(40);

    // srcId matching an existing patient name
    const resp1 = await request(app)
      .get("/api/books/")
      .query({
        _relation_path_: JSON.stringify({
          relation: ".books.patients$name",
          srcId: "Kirk Douglas",
        }),
      })
      .expect(200);

    // srcId with a non-existent patient name
    const resp2 = await request(app)
      .get("/api/books/")
      .query({
        _relation_path_: JSON.stringify({
          relation: ".books.patients$name",
          srcId: "ZZZNONEXISTENT",
        }),
      })
      .expect(200);

    // If the relation_path is allowed without authorization, resp1 returns
    // book id=1 (because patient "Kirk Douglas" has id=1) while resp2
    // returns nothing. The difference reveals that "Kirk Douglas" exists
    // in the restricted patients table.
    //
    // Secure behavior: both queries return the same results (the subquery
    // against the restricted table is blocked or ignored), OR the query
    // is rejected.
    const rows1 = resp1.body.success || [];
    const rows2 = resp2.body.success || [];
    expect(rows1.length).toBe(rows2.length);
  });

  it("should not allow probing restricted tables via dot-prefix relation path", async () => {
    const app = await getApp({ disableCsrf: true });
    // The dot-prefix syntax (e.g. ?.books.patients$name=value) is another
    // way to invoke handleRelationPath, which has no authorization checks.
    // This constructs the same inSelectWithLevels subquery.
    const patients = Table.findOne({ name: "patients" });
    expect(patients.min_role_read).toBe(40);

    const resp1 = await request(app)
      .get("/api/books/")
      .query({ ".books.patients$name": "Kirk Douglas" })
      .expect(200);

    const resp2 = await request(app)
      .get("/api/books/")
      .query({ ".books.patients$name": "ZZZNONEXISTENT" })
      .expect(200);

    const rows1 = resp1.body.success || [];
    const rows2 = resp2.body.success || [];
    expect(rows1.length).toBe(rows2.length);
  });

  it("should not allow probing a restricted parent table via forward-key relation path (ISSUE3)", async () => {
    const app = await getApp({ disableCsrf: true });
    // the forward foreign-key branch of handleRelationPath() checks the
    // requesting user's role against the SOURCE table twice, instead of against
    // the referenced (destination) table on the second check. A public user who
    // can read `books` (min_role_read=100) can therefore traverse the FK
    // `books.publisher` into the admin-only `publisher` table (min_role_read=1)
    // and use the empty-vs-nonempty result set as an oracle to enumerate which
    // publisher primary keys exist.
    const books = Table.findOne({ name: "books" });
    const publisher = Table.findOne({ name: "publisher" });
    expect(books.min_role_read).toBe(100); // publicly readable
    expect(publisher.min_role_read).toBe(1); // admin only

    // Direct access to the restricted table is correctly blocked for the public.
    await request(app).get("/api/publisher/").expect(notAuthorized);

    // Find a publisher id that is actually referenced by a book, so a leaking
    // query would return a non-empty result.
    const referencingBook = await books.getRow({ publisher: { gt: 0 } });
    const existingPublisherId = referencingBook.publisher;
    expect(existingPublisherId).toBeGreaterThan(0);
    const nonExistentPublisherId = 999999;

    // Probe with an existing publisher id vs a non-existent one, unauthenticated.
    const resp1 = await request(app)
      .get("/api/books/")
      .query({
        _relation_path_: JSON.stringify({
          relation: ".books.publisher",
          srcId: `${existingPublisherId}`,
        }),
      })
      .expect(200);
    const resp2 = await request(app)
      .get("/api/books/")
      .query({
        _relation_path_: JSON.stringify({
          relation: ".books.publisher",
          srcId: `${nonExistentPublisherId}`,
        }),
      })
      .expect(200);

    // Secure behavior: the traversal into the admin-only publisher table is
    // blocked/ignored, so the two probes are indistinguishable (both same
    // count). If vulnerable, the existing-id probe leaks the referencing book
    // while the non-existent-id probe returns nothing.
    const rows1 = resp1.body.success || [];
    const rows2 = resp2.body.success || [];
    expect(rows1.length).toBe(rows2.length);
  });

  it("ownership on the destination table must not reopen the relation-path oracle (ISSUE3)", async () => {
    // Guards against a future well-meaning change that allows relation-path
    // traversal when the user *owns* rows in the restricted destination table
    // (e.g. `role_id <= min_role_read || is_owner`). That would let an owner
    // filter by any destination primary key — not just owned rows — because the
    // subquery filters by raw pk and does NOT apply the destination's
    // ownership_formula_where. The security invariant: a user who does not meet
    // the destination table's min_role_read cannot distinguish existing from
    // non-existing destination pks, EVEN IF they own rows in that table.
    const books = Table.findOne({ name: "books" });
    const publisher = Table.findOne({ name: "publisher" });
    expect(publisher.min_role_read).toBe(1); // admin only

    // Find a publisher id that is referenced by a book (so a leaking traversal
    // would return that book).
    const referencingBook = await books.getRow({ publisher: { gt: 0 } });
    const existingPublisherId = referencingBook.publisher;
    const nonExistentPublisherId = 999999;

    // Make user@foo.com (id 3, role 80) an owner of publisher rows.
    const originalFormula = publisher.ownership_formula;
    try {
      await publisher.update({ ownership_formula: "user.id === 3" });
      const reloaded = Table.findOne({ name: "publisher" });
      const somePublisher = await reloaded.getRow({ id: existingPublisherId });
      // Sanity: the user genuinely owns the referenced destination row.
      expect(reloaded.is_owner({ id: 3, role_id: 80 }, somePublisher)).toBe(
        true
      );

      const user = await User.findOne({ email: "user@foo.com" });
      expect(user.role_id).toBe(80); // does NOT meet publisher.min_role_read=1
      const userToken = await user.getNewAPIToken();
      const app = await getApp({ disableCsrf: true });

      const respOwned = await request(app)
        .get("/api/books/")
        .set("Authorization", "Bearer " + userToken)
        .query({
          _relation_path_: JSON.stringify({
            relation: ".books.publisher",
            srcId: `${existingPublisherId}`,
          }),
        })
        .expect(200);
      const respMissing = await request(app)
        .get("/api/books/")
        .set("Authorization", "Bearer " + userToken)
        .query({
          _relation_path_: JSON.stringify({
            relation: ".books.publisher",
            srcId: `${nonExistentPublisherId}`,
          }),
        })
        .expect(200);

      // Even though the user owns publisher rows, probing an existing (owned,
      // referenced) publisher pk must be indistinguishable from probing a
      // missing pk — the role gate blocks the traversal before ownership is
      // ever consulted.
      const ownedRows = respOwned.body.success || [];
      const missingRows = respMissing.body.success || [];
      expect(ownedRows.length).toBe(missingRows.length);
    } finally {
      await publisher.update({ ownership_formula: originalFormula || null });
    }
  });
});

describe("API CSRF protection", () => {
  let adminToken, adminJwt;

  beforeAll(async () => {
    const admin = await User.findOne({ email: "admin@foo.com" });
    adminToken = await admin.getNewAPIToken();
    adminJwt = await getAdminJwt();
    await Trigger.create({
      action: "run_js_code",
      when_trigger: "API call",
      name: "apicallpublic1",
      min_role: 100,
      configuration: {
        code: `return {foo: "bar"}`,
      },
    });
  });

  it("should reject POST with session cookie but no CSRF token", async () => {
    const app = await getApp({ disableCsrf: false });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/api/books/")
      .set("Cookie", loginCookie)
      .send({ author: "CSRF Test", pages: 1 })
      .set("Content-Type", "application/json")
      .expect(302);
  });

  it("should allow POST with bearer token and no CSRF token", async () => {
    const app = await getApp({ disableCsrf: false });
    await request(app)
      .post("/api/books/")
      .set("Authorization", "Bearer " + adminToken)
      .send({ author: "Bearer No CSRF", pages: 2 })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(succeedJsonWith((resp) => resp && typeof resp === "number"));
  });

  it("should allow POST to public api with no bearer token and no CSRF token", async () => {
    const app = await getApp({ disableCsrf: false });
    await request(app)
      .post("/api/action/apicallpublic1")
      .send({})
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(200)
      .expect(
        succeedJsonWithWholeBody(
          (resp) => resp?.data?.foo === "bar" && resp.success === true
        )
      );
  });

  it("should allow POST with valid JWT and no CSRF token", async () => {
    const app = await getApp({ disableCsrf: false });
    await request(app)
      .post("/api/books/")
      .set("Authorization", `jwt ${adminJwt}`)
      .send({ author: "JWT No CSRF", pages: 3 })
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .expect(succeedJsonWith((resp) => resp && typeof resp === "number"));
  });

  it("should not bypass CSRF by appending a fake ?jwt= query parameter", async () => {
    const app = await getApp({ disableCsrf: false });
    const loginCookie = await getAdminLoginCookie();

    await request(app)
      .post("/api/books/?jwt=fakejwt")
      .send({ author: "CSRF Bypass Attempt", pages: 4 })
      .set("Cookie", loginCookie)
      .set("Content-Type", "application/json")
      .expect(302);
  });
});
