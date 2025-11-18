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
      .post("/api/emit-event/event1")
      .set("Authorization", `jwt ${token}`)
      .send({ payload: { latitude: 20, longitude: 30 } })
      .expect(succeedJsonWith((success) => success === true));
    await sleep(200);
  });

  it("denies an event without JWT", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post("/api/emit-event/event1")
      .send({ payload: { latitude: 20, longitude: 30 } })
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
