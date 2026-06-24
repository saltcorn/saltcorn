/**
 * @category server
 * @module auth/testhelp
 * @subcategory auth
 */
/*global it, expect*/
const http = require("http");
const assert = require("assert");
const { makeFetch } = require("supertest-fetch");
const app = require("../app");
const getApp = require("../app");
const fixtures = require("@saltcorn/data/db/fixtures");
const reset = require("@saltcorn/data/db/reset_schema");
const jsdom = require("jsdom");
const { JSDOM, ResourceLoader } = jsdom;

/**
 * supertest-compatible shim over supertest-fetch (native fetch).
 *
 * supertest is replaced because it drags in a large tree of out-of-date
 * dependencies. supertest-fetch uses the platform's native fetch, but exposes
 * a fetch-style API. This shim wraps it so the existing tests keep using the
 * familiar `request(app).get(path).set(...).send(...).expect(...)` chain and
 * receive a supertest-style response object (`.statusCode`, `.text`, `.body`,
 * `.headers`, `.type`).
 */
const lc = (h) => String(h).toLowerCase();

// convert a native fetch Response into a supertest-like response object
const toSuperRes = async (response) => {
  const buf = Buffer.from(await response.arrayBuffer());
  const text = buf.toString("utf-8");
  const headers = {};
  response.headers.forEach((v, k) => {
    headers[lc(k)] = v;
  });
  // fetch joins multiple set-cookie headers; recover them as an array so
  // cookie helpers can iterate (as they did with supertest)
  if (typeof response.headers.getSetCookie === "function") {
    const setCookie = response.headers.getSetCookie();
    if (setCookie && setCookie.length) headers["set-cookie"] = setCookie;
  }
  const contentType = headers["content-type"] || "";
  let body;
  if (contentType.includes("json")) {
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }
  } else {
    // non-json: a Buffer, matching superagent (supports .length etc.)
    body = buf;
  }
  return {
    status: response.status,
    statusCode: response.status,
    ok: response.ok,
    type: contentType.split(";")[0].trim(),
    text,
    body,
    // superagent exposes the parsed body as both .body and ._body
    _body: body,
    headers,
  };
};

// apply a single supertest `.expect(...)` assertion against the response
const runExpectation = (res, args) => {
  if (args.length >= 2) {
    const [field, value] = args;
    const got = res.headers[lc(field)];
    if (got !== value)
      throw new Error(
        `Expected header "${field}" to be "${value}", received "${got}"`
      );
    return;
  }
  const a = args[0];
  if (typeof a === "number") {
    if (res.statusCode !== a) {
      console.log(res.text);
      throw new Error(`Expected status ${a}, received ${res.statusCode}`);
    }
  } else if (typeof a === "function") {
    a(res);
  } else if (typeof a === "string") {
    if (res.text !== a)
      throw new Error(`Expected body "${a}", received "${res.text}"`);
  } else if (a && typeof a === "object") {
    assert.deepEqual(res.body, a);
  }
};

// a lazy, thenable request builder mirroring supertest's chainable API
class SuperRequest {
  constructor(fetch, method, path) {
    this._fetch = fetch;
    this._method = method;
    this._path = path;
    this._headers = {};
    this._expectations = [];
    this._query = undefined;
    this._urlencoded = undefined;
    this._json = undefined;
    this._form = undefined;
  }
  set(field, value) {
    if (field && typeof field === "object")
      for (const [k, v] of Object.entries(field)) this._headers[k] = v;
    else this._headers[field] = value;
    return this;
  }
  query(obj) {
    this._query = { ...(this._query || {}), ...obj };
    return this;
  }
  send(data) {
    if (data === undefined) return this;
    if (typeof data === "string")
      this._urlencoded =
        (this._urlencoded ? this._urlencoded + "&" : "") + data;
    else if (Array.isArray(data))
      // an array body is sent verbatim as JSON (do not spread into an object)
      this._json = data;
    else this._json = { ...(this._json || {}), ...data };
    return this;
  }
  _ensureForm() {
    if (!this._form) this._form = new FormData();
    return this._form;
  }
  field(name, value) {
    this._ensureForm().append(name, value);
    return this;
  }
  attach(name, buffer, filename) {
    this._ensureForm().append(name, new Blob([buffer]), filename || name);
    return this;
  }
  expect(...args) {
    this._expectations.push(args);
    return this;
  }
  async _run() {
    let url = this._path;
    if (this._query) {
      const qs = new URLSearchParams(this._query).toString();
      url += (url.includes("?") ? "&" : "?") + qs;
    }
    const headers = {};
    for (const [k, v] of Object.entries(this._headers))
      headers[k] = Array.isArray(v) ? v.join("; ") : v;
    // native fetch forbids overriding the Host header; forward it as
    // X-Forwarded-Host instead (Express reads it when "trust proxy" is set)
    for (const k of Object.keys(headers))
      if (lc(k) === "host") {
        headers["X-Forwarded-Host"] = headers[k];
        delete headers[k];
      }
    // supertest does not follow redirects; keep 3xx responses as-is
    const opts = { method: this._method, headers, redirect: "manual" };
    const hasContentType = () =>
      Object.keys(headers).some((k) => lc(k) === "content-type");
    if (this._form) {
      opts.body = this._form;
      // let fetch set the multipart content-type (with boundary)
      for (const k of Object.keys(headers))
        if (lc(k) === "content-type") delete headers[k];
    } else if (this._json !== undefined) {
      opts.body = JSON.stringify(this._json);
      if (!hasContentType()) headers["Content-Type"] = "application/json";
    } else if (this._urlencoded !== undefined) {
      opts.body = this._urlencoded;
      if (!hasContentType())
        headers["Content-Type"] = "application/x-www-form-urlencoded";
    }
    const response = await this._fetch(url, opts);
    const res = await toSuperRes(response);
    for (const args of this._expectations) runExpectation(res, args);
    return res;
  }
  then(onFulfilled, onRejected) {
    return this._run().then(onFulfilled, onRejected);
  }
  catch(onRejected) {
    return this._run().catch(onRejected);
  }
  finally(onFinally) {
    return this._run().finally(onFinally);
  }
}

/**
 * Drop-in replacement for `require("supertest")`: returns an object with
 * get/post/put/delete/patch/head methods that each start a chainable request.
 * @param {object} app - an express app (or any http request listener)
 * @returns {object}
 */
const request = (app) => {
  // native fetch cannot set the Host header, so the shim forwards it as
  // X-Forwarded-Host; trust the proxy header so Express derives the hostname
  // (and tenant subdomain) from it, matching how supertest's real Host did.
  if (app && typeof app.set === "function") app.set("trust proxy", true);
  const server = http.createServer(app);
  const fetch = makeFetch(server);
  const make = (method) => (path) => new SuperRequest(fetch, method, path);
  return {
    get: make("GET"),
    post: make("POST"),
    put: make("PUT"),
    delete: make("DELETE"),
    patch: make("PATCH"),
    head: make("HEAD"),
  };
};

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

const getAdminJwt = async () => {
  const app = await getApp({ disableCsrf: true });
  const headers = {
    "X-Requested-With": "XMLHttpRequest",
    "X-Saltcorn-Client": "mobile-app",
  };
  const res = await request(app)
    .post("/auth/login-with/jwt")
    .set(headers)
    .send({ email: "admin@foo.com", password: "AhGGr6rhu45" });
  if (res.statusCode !== 200) console.log(res.text);
  return res.body;
};

const getStaffJwt = async () => {
  const app = await getApp({ disableCsrf: true });
  const headers = {
    "X-Requested-With": "XMLHttpRequest",
    "X-Saltcorn-Client": "mobile-app",
  };
  const res = await request(app)
    .post("/auth/login-with/jwt")
    .set(headers)
    .send({ email: "staff@foo.com", password: "ghrarhr54hg" });
  if (res.statusCode !== 200) console.log(res.text);
  return res.body;
};

const getUserJwt = async () => {
  const app = await getApp({ disableCsrf: true });
  const headers = {
    "X-Requested-With": "XMLHttpRequest",
    "X-Saltcorn-Client": "mobile-app",
  };
  const res = await request(app)
    .post("/auth/login-with/jwt")
    .set(headers)
    .send({ email: "user@foo.com", password: "GFeggwrwq45fjn" });
  if (res.statusCode !== 200) console.log(res.text);
  return res.body;
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

const itShouldNotIncludeTextForAdmin = (path, text) => {
  it(`should show admin ${text} on ${path}`, async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(path)
      .set("Cookie", loginCookie)
      .expect(200)
      .expect(toNotInclude(text));
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
  class FakeIntersectionObserver {
    constructor() {}
    observe() {}
  }

  dom.window.XMLHttpRequest = FakeXHR;
  dom.window.IntersectionObserver = FakeIntersectionObserver;
  await new Promise(function (resolve, reject) {
    dom.window.addEventListener("DOMContentLoaded", (event) => {
      resolve();
    });
  });
  return dom;
};

module.exports = {
  request,
  getStaffLoginCookie,
  getAdminLoginCookie,
  getUserLoginCookie,
  getAdminJwt,
  getStaffJwt,
  getUserJwt,
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
  itShouldNotIncludeTextForAdmin,
  load_url_dom,
};
