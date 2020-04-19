const request = require("supertest");
const cheerio = require("cheerio");
const CrawlState = require("./crawl-state");

const toSucceed = res => {
  if (res.statusCode >= 400) {
    console.log(res.text);
    throw new Error(`Received ${res.statusCode}`);
  }
};

const oneOf = vs => vs[Math.floor(Math.random() * vs.length)];

const run = async (app, options = {}) => {
  const startAt = options.startAt || "/";
  const state = new CrawlState();
  await get_link(app, startAt, state, options.steps || 10);
};

const isLocalURL = url =>
  url &&
  !url.startsWith("javascript:") &&
  new URL(url, "http://my.local/").origin === "http://my.local";

const get_link = async (app, url, state, steps_left) => {
  console.log("Checking page", url);
  const res = await request(app)
    .get(url)
    .set("Accept", "text/html");
  expect(toSucceed);
  //console.log(res.text);
  await process(res, app, url, state, steps_left);
};

const genRandom = input => {
  return "foo";
};

const submit_form = async (app, form, url, state, steps_left) => {
  const action = form.attr("action");
  const method = (form.attr("method") || "post").toLowerCase();
  //console.log({ form });

  console.log("submitting form at", action);
  const inputs = form.find("input").toArray();
  //console.log({ inputs });
  if (method === "post") {
    var req = request(app).post(action);
    for (const input of inputs) {
      const oldreq = req;
      req = oldreq.send(`${input.attribs.name}=${genRandom(input)}`);
    }
    const res = await req.expect(toSucceed);
    await process(res, app, url, state, steps_left);
  } else if (method === "get") {
    var url = action + "?";
    for (const input of inputs) {
      url += `${input.attribs.name}=${genRandom(input)}`;
    }
    const res = await request(app)
      .get(action)
      .expect(toSucceed);
    await process(res, app, url, state, steps_left);
  }
};
const rndElem = selection => {
  var random = Math.floor(Math.random() * selection.length);
  return selection.eq(random);
};
const process = async (res, app, url, state, steps_left) => {
  if (res.status === 302) {
    console.log("redirect to", res.headers.location);
    const nextres = await request(app).get(res.headers.location);
    return await process(nextres, app, url, state, steps_left);
  }

  const $ = cheerio.load(res.text);

  var local_links = $("a[href]").filter((i, e) => isLocalURL(e.attribs.href));
  var forms = $("form");
  if (steps_left) {
    if (forms.length > 0 && local_links.length > 0)
      if (Math.random() < 0.2)
        return await get_link(
          app,
          rndElem(local_links).attr("href"),
          state,
          steps_left - 1
        );
      else return await submit_form(app, rndElem(forms), state, steps_left - 1);

    if (forms.length > 0)
      return await submit_form(app, rndElem(forms), state, steps_left - 1);

    if (local_links.length > 0)
      return await get_link(
        app,
        rndElem(local_links).attr("href"),
        state,
        steps_left - 1
      );
  }
};

module.exports = run;
