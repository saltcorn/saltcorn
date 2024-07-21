/**
 * @category server
 * @module auth/testhelp
 * @subcategory auth
 */
/*global it, expect*/
const request = require("supertest");
const app = require("../app");
const getApp = require("../app");
const fixtures = require("@saltcorn/data/db/fixtures");
const reset = require("@saltcorn/data/db/reset_schema");
const jsdom = require("jsdom");
const { JSDOM, ResourceLoader } = jsdom;

/**
 *
 * @param {string} loc
 * @returns {void}
 * @throws {Error}
 */
const toRedirect = (loc) => (res) => {
  if (res.statusCode !== 302) {
    console.log(res.text);
    throw new Error("Expected redirect, received " + res.statusCode);
  }
  const gotLoc = res.headers["location"];
  if (gotLoc !== loc) {
    throw new Error(`Expected location ${loc} received ${gotLoc}`);
  }
};

/**
 *
 * @param {string|string[]} exp expected string or for arrrays at least one must be present
 * @param {number} expCode
 * @returns {void}
 * @throws {Error}
 */
const toInclude =
  (exp, expCode = 200) =>
  (res) => {
    if (res.statusCode !== expCode) {
      console.log(res.text);
      throw new Error(
        `Expected status ${expCode} when looking for "${exp}", received ${res.statusCode}`
      );
    }
    const check = (txt) => res.text.includes(txt);
    if (Array.isArray(exp)) {
      if (!exp.some(check)) {
        console.log(res.text);
        throw new Error(`Expected text from [${exp.join(", ")}] not found`);
      }
    } else if (!check(exp)) {
      console.log(res.text);
      throw new Error(`Expected text ${exp} not found`);
    }
  };

const toBeTrue =
  (pred, expCode = 200) =>
  (res) => {
    if (res.statusCode !== expCode) {
      console.log(res.text);
      throw new Error(
        `Expected status ${expCode} when checking predicate, received ${res.statusCode}`
      );
    }
    if (!pred(res)) {
      console.log(res.text);
      throw new Error(`Expected predicate not true`);
    }
  };

/**
 *
 * @param {number} expCode
 * @returns {void}
 * @throws {Error}
 */
const toSucceed =
  (expCode = 200) =>
  (res) => {
    if (res.statusCode !== expCode) {
      console.log(res.text);
      throw new Error(`Expected status ${expCode}, received ${res.statusCode}`);
    }
  };

/**
 *
 * @param {number} expCode
 * @returns {void}
 * @throws {Error}
 */
const toSucceedWithImage =
  ({ expCode = 200, lengthIs }) =>
  (res) => {
    if (res.statusCode !== expCode) {
      console.log(res.text);
      throw new Error(`Expected status ${expCode}, received ${res.statusCode}`);
    }
    if (res.type.split("/")[0] !== "image") {
      throw new Error(`Expected response type image/*, received ${res.type}`);
    }
    if (lengthIs && !lengthIs(res.body.length)) {
      throw new Error(
        `Image response not accepted. Length not satisfied. Received ${res.body.length} bytes`
      );
    }
  };

/**
 *
 * @param {number} txt
 * @param {number} expCode
 * @returns {void}
 * @throws {Error}
 */
const toNotInclude =
  (txt, expCode = 200) =>
  (res) => {
    if (res.statusCode !== expCode) {
      console.log(res.text);
      throw new Error(
        `Expected status ${expCode} when not lookinng for "${txt}", received ${res.statusCode}`
      );
    }

    if (res.text.includes(txt)) {
      console.log(res.text);
      throw new Error(`Expected text ${txt} to be absent, but was present`);
    }
  };

const resToLoginCookie = (res) =>
  res.headers["set-cookie"].find((c) => c.includes("connect.sid"));

/**
 *
 * @returns {Promise<void>}
 */
const getStaffLoginCookie = async () => {
  const app = await getApp({ disableCsrf: true });
  const res = await request(app)
    .post("/auth/login/")
    .send("email=staff@foo.com")
    .send("password=ghrarhr54hg");
  if (res.statusCode !== 302) console.log(res.text);
  return resToLoginCookie(res);
};

/**
 *
 * @returns {Promise<void>}
 */
const getUserLoginCookie = async () => {
  const app = await getApp({ disableCsrf: true });
  const res = await request(app)
    .post("/auth/login/")
    .send("email=user@foo.com")
    .send("password=GFeggwrwq45fjn");
  if (res.statusCode !== 302) console.log(res.text);
  return resToLoginCookie(res);
};

/**
 *
 * @returns {Promise<void>}
 */
const getAdminLoginCookie = async () => {
  const app = await getApp({ disableCsrf: true });
  const res = await request(app)
    .post("/auth/login/")
    .send("email=admin@foo.com")
    .send("password=AhGGr6rhu45");
  if (res.statusCode !== 302) console.log(res.text);
  return resToLoginCookie(res);
};

/**
 *
 * @param {*} width
 * @param {*} height
 * @param {*} innerWidth
 * @param {*} innerHeight
 * @returns
 */
const prepScreenInfoCookie = (width, height, innerWidth, innerHeight) => {
  return `_sc_screen_info_=${JSON.stringify({
    width,
    height,
    innerWidth: innerWidth || width,
    innerHeight: innerHeight || height,
  })}; Path=/;`;
};

const prepUserAgent = () => {
  return `user-agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/535.2 (KHTML, like Gecko) Ubuntu/11.10 Chromium/15.0.874.106 Chrome/15.0.874.106 Safari/535.2"; Path=/;`;
};

/**
 *
 * @param {string} path
 * @param {string} dest
 * @returns {void}
 */
const itShouldRedirectUnauthToLogin = (path, dest) => {
  it(`should redirect unauth ${path} to ${dest || "login"}`, async () => {
    const app = await getApp({ disableCsrf: true });
    const res = await request(app)
      .get(path)
      .expect(302)
      .expect(
        "Location",
        dest || `/auth/login?dest=${encodeURIComponent(path)}`
      );

    expect(res.statusCode).toEqual(302);
  });
};

const itShouldIncludeTextForAdmin = (path, text) => {
  it(`should show admin ${text} on ${path}`, async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(path)
      .set("Cookie", loginCookie)
      .expect(200)
      .expect(toInclude(text));
  });
};

/**
 * @returns {Promise<void>}
 */
const resetToFixtures = async () => {
  await reset();
  await fixtures();
};

/**
 *
 * @param {*} pred
 * @returns {void}
 * @throws {Error}
 */
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

const succeedJsonWithWholeBody = (pred) => (res) => {
  if (res.statusCode !== 200) {
    console.log(res.text);
    throw new Error(`Expected status 200, received ${res.statusCode}`);
  }

  if (!pred(res.body)) {
    console.log(res.body);
    throw new Error(`Not satisfied`);
  }
};

/**
 *
 * @param {number} code
 * @param {number} pred
 * @returns {void}
 * @throws {Error}
 */
const respondJsonWith = (code, pred) => (res) => {
  if (res.statusCode !== code) {
    console.log(res.text);
    throw new Error(`Expected status ${code}, received ${res.statusCode}`);
  }

  if (!pred(res.body)) {
    console.log(res.body);
    throw new Error(`Not satisfied`);
  }
};

/**
 *
 * @param {object} res
 * @returns {void}
 * @throws {Error}
 */
const notAuthorized = (res) => {
  if (res.statusCode !== 401) {
    console.log(res.text);
    throw new Error(`Expected status 401, received ${res.statusCode}`);
  }
};

const notFound = (res) => {
  if (res.statusCode !== 404) {
    console.log(res.text);
    throw new Error(`Expected status 404, received ${res.statusCode}`);
  }
};

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
      this.requestHeaders = [];
      //return traceMethodCalls(this);
    }
    open(method, url) {
      //console.log("open xhr", method, url);
      this.method = method;
      this.url = url;
    }

    addEventListener(ev, reqListener) {
      if (ev === "load") this.reqListener = reqListener;
    }
    setRequestHeader(k, v) {
      this.requestHeaders.push([k, v]);
    }
    overrideMimeType() {}
    async send(body) {
      //console.log("send1", this.url);
      const url1 = this.url.replace("http://localhost", "");
      //console.log("xhr fetching", url1);
      let req =
        this.method == "POST"
          ? request(app).post(url1)
          : request(app).get(url1);
      for (const [k, v] of this.requestHeaders) {
        req = req.set(k, v);
      }
      if (this.method === "POST" && body) req.send(body);
      const res = await req;
      this.responseHeaders = res.headers;
      if (res.headers["content-type"].includes("json"))
        this.responseType = "json";
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
      return Object.entries(this.responseHeaders)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
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

module.exports = {
  getStaffLoginCookie,
  getAdminLoginCookie,
  getUserLoginCookie,
  prepScreenInfoCookie,
  prepUserAgent,
  itShouldRedirectUnauthToLogin,
  toRedirect,
  toInclude,
  toNotInclude,
  toSucceed,
  toBeTrue,
  resetToFixtures,
  succeedJsonWith,
  notAuthorized,
  notFound,
  respondJsonWith,
  toSucceedWithImage,
  succeedJsonWithWholeBody,
  resToLoginCookie,
  itShouldIncludeTextForAdmin,
  load_url_dom,
};
