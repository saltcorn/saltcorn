const request = require("supertest");
const getApp = require("../app");
const { resetToFixtures } = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");

const { plugin_with_routes, sleep } = require("@saltcorn/data/tests/mocks");
const jsdom = require("jsdom");
const { JSDOM, ResourceLoader } = jsdom;
afterAll(db.close);
beforeAll(async () => {
  await resetToFixtures();
});

jest.setTimeout(30000);

const load_url_dom = async (url) => {
  const app = await getApp({ disableCsrf: true });
  class CustomResourceLoader extends ResourceLoader {
    async fetch(url, options) {
      const url1 = url.replace("http://localhost", "");
      //console.log("fetching", url, url1);
      const res = await request(app).get(url1);

      return Buffer.from(res.text);
    }
  }
  const reqres = await request(app).get(url);
  //console.log("rr1", reqres.text);
  const virtualConsole = new jsdom.VirtualConsole();
  virtualConsole.sendTo(console);
  const dom = new JSDOM(reqres.text, {
    url: "http://localhost" + url,
    runScripts: "dangerously",
    resources: new CustomResourceLoader(),
    pretendToBeVisual: true,
    virtualConsole,
  });

  class FakeXHR {
    constructor() {
      this.readyState = 0;

      //return traceMethodCalls(this);
    }
    open(method, url) {
      console.log("open xhr", method, url);
      this.method = method;
      this.url = url;
    }

    addEventListener(ev, reqListener) {
      if (ev === "load") this.reqListener = reqListener;
    }
    setRequestHeader() {}
    overrideMimeType() {}
    async send() {
      console.log("send1", this.url);
      const url1 = this.url.replace("http://localhost", "");
      console.log("xhr fetching", url1);
      const res = await request(app).get(url1);
      this.response = res.text;
      this.responseText = res.text;
      this.status = res.status;
      this.statusText = "OK";
      this.readyState = 4;
      if (this.reqListener) this.reqListener(res.text);
      if (this.onload) this.onload(res.text);
      //console.log("agent res", res);
      //console.log("xhr", this);
    }
    getAllResponseHeaders() {
      return [];
    }
  }
  dom.window.XMLHttpRequest = FakeXHR;
  await new Promise(function (resolve, reject) {
    dom.window.addEventListener("DOMContentLoaded", (event) => {
      resolve();
    });
  });
  return dom;
};
function traceMethodCalls(obj) {
  let handler = {
    get(target, propKey, receiver) {
      console.log(propKey);
      const origMethod = target[propKey];
      return function (...args) {
        let result = origMethod.apply(this, args);
        console.log(
          propKey + JSON.stringify(args) + " -> " + JSON.stringify(result)
        );
        return result;
      };
    },
  };
  return new Proxy(obj, handler);
}
describe("JSDOM test", () => {
  it("should load authorlist", async () => {
    const dom = await load_url_dom("/view/authorlist");
    //console.log("dom", dom);
  });
  it("should user filter to change url", async () => {
    await View.create({
      viewtemplate: "Filter",
      description: "",
      min_role: 100,
      name: `authorfilter1`,
      table_id: Table.findOne("books")?.id,
      default_render_page: "",
      slug: {},
      attributes: {},
      configuration: {
        layout: {
          type: "field",
          block: false,
          fieldview: "edit",
          textStyle: "",
          field_name: "author",
          configuration: {},
        },
        columns: [
          {
            type: "Field",
            block: false,
            fieldview: "edit",
            textStyle: "",
            field_name: "author",
            configuration: {},
          },
        ],
      },
    });
    const dom = await load_url_dom("/view/authorfilter1");
    expect(dom.window.location.href).toBe(
      "http://localhost/view/authorfilter1"
    );
    //console.log(dom.serialize());
    const input = dom.window.document.querySelector("input[name=author]");
    input.value = "Leo";
    input.dispatchEvent(new dom.window.Event("change"));
    await sleep(2000);
    expect(dom.window.location.href).toBe(
      "http://localhost/view/authorfilter11?author=Leo"
    );

    //console.log("dom", dom);
  });
});
