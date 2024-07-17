const request = require("supertest");
const getApp = require("../app");
const {
  toRedirect,
  getAdminLoginCookie,
  getStaffLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  resetToFixtures,
  respondJsonWith,
  toSucceed,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");

const { plugin_with_routes } = require("@saltcorn/data/tests/mocks");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
afterAll(db.close);
beforeAll(async () => {
  await resetToFixtures();
});

jest.setTimeout(30000);

const load_url_dom = async (url) => {
  const app = await getApp({ disableCsrf: true });
  class CustomResourceLoader extends jsdom.ResourceLoader {
    async fetch(url, options) {
      const url1 = url.replace("http://localhost", "");
      const res = await request(app).get(url1);

      return Buffer.from(res.text);
    }
  }
  const reqres = await request(app).get(url);
  //console.log("rr1", reqres.text);
  const dom = new JSDOM(reqres.text, {
    url: "http://localhost",
    runScripts: "dangerously",
    resources: new CustomResourceLoader(),
    pretendToBeVisual: true,
  });

  await new Promise(function (resolve, reject) {
    dom.window.addEventListener("DOMContentLoaded", (event) => {
      resolve();
    });
  });
  return dom;
};

describe("JSDOM test", () => {
  it("should load authorlist", async () => {
    const dom = await load_url_dom("/view/authorlist");
    //console.log("dom", dom);
  });
});
