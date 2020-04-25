const request = require("supertest");
const cheerio = require("cheerio");
const CrawlState = require("./crawl-state");

const toSucceed = state => res => {
  if (res.statusCode >= 400) {
    console.log(res.text);
    console.log(state.log.slice(Math.max(state.log.length - 3, 0)));
    throw new Error(`Received ${res.statusCode}`);
  }
};

const oneOf = vs => vs[Math.floor(Math.random() * vs.length)];

const run = async (app, options = {}) => {
  const startAt = options.startAt || "/";
  const state = new CrawlState(options);
  await get_link(app, startAt, state);
};

const isLocalURL = url =>
  url &&
  !url.startsWith("javascript:") &&
  new URL(url, "http://my.local/").origin === "http://my.local";

const get_link = async (app, url, state) => {
  state.add_log({ get: url });
  const res = await request(app)
    .get(url)
    .set("Cookie", state.cookie)
    .set("Accept", "text/html");
  expect(toSucceed(state));
  //console.log(res.text);
  await process(res, app, url, state);
};

const genRandom = input => {
  return "foo";
};

const submit_form = async (app, form, state) => {
  const action = form.attr("action");
  const method = (form.attr("method") || "post").toLowerCase();
  //console.log({ form });

  const inputs = form.find("input").toArray();
  //console.log({ inputs });
  var body = {};

  if (method === "post") {
    var req = request(app)
      .post(action)
      .set("Cookie", state.cookie);
    for (const input of inputs) {
      const oldreq = req;
      const val = genRandom(input);
      req = oldreq.send(`${input.attribs.name}=${val}`);
      body[input.attribs.name] = val;
    }
    state.add_log({ post: action, body });
    const res = await req.expect(toSucceed(state));
    await process(res, app, url, state);
  } else if (method === "get") {
    var url = action + "?";
    for (const input of inputs) {
      const val = genRandom(input);
      url += `${input.attribs.name}=${val}`;
      body[input.attribs.name] = val;
    }

    state.add_log({ getForm: action, query: body });
    const res = await request(app)
      .get(url)
      .set("Cookie", state.cookie)
      .expect(toSucceed(state));
    await process(res, app, url, state);
  }
};
const rndElem = selection => {
  var random = Math.floor(Math.random() * selection.length);
  return selection.eq(random);
};
const process = async (res, app, url, state) => {
  if (res.status === 302) {
    return await get_link(app, res.headers.location, state);
  }

  const $ = cheerio.load(res.text);

  var local_links = $("a[href]").filter((i, e) => isLocalURL(e.attribs.href));
  var forms = $("form").filter((i, e) =>
    state.check_form_action(e.attribs.action)
  );
  if (state.steps_remaining) {
    if (forms.length > 0 && local_links.length > 0)
      if (Math.random() < 0.2)
        return await get_link(
          app,
          rndElem(local_links).attr("href"),
          state.decr()
        );
      else return await submit_form(app, rndElem(forms), state.decr());

    if (forms.length > 0)
      return await submit_form(app, rndElem(forms), state.decr());

    if (local_links.length > 0)
      return await get_link(
        app,
        rndElem(local_links).attr("href"),
        state.decr()
      );
  }
};

module.exports = run;
