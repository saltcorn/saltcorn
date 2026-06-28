const request = require("../auth/testhelp").request;
const getApp = require("../app");
const { resetToFixtures } = require("../auth/testhelp");
const db = require("@saltcorn/data/db");

beforeAll(async () => {
  await resetToFixtures();
});

jest.setTimeout(30000);

describe("static assets", () => {
  it("serves the builder bundle", async () => {
    const app = await getApp({ disableCsrf: true });
    const version_tag = db.connectObj.version_tag;
    await request(app)
      .get(`/static_assets/${version_tag}/builder_bundle.js`)
      .expect(200)
      .expect((res) => {
        if (!/javascript/.test(res.headers["content-type"]))
          throw new Error(
            `Expected a javascript Content-Type, received "${res.headers["content-type"]}"`
          );
        if (!res.text || res.text.length < 1000)
          throw new Error("builder bundle body is empty or too small");
      });
  });
});
