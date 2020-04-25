const cheerio = require("cheerio");
const CrawlState = require("./crawl-state");
const seedrandom = require("seedrandom");
const { is } = require("contractis");

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
  const state = new CrawlState({ app, ...options });
  return await get_link(startAt, state);
};

const isLocalURL = url =>
  url &&
  !url.startsWith("javascript:") &&
  new URL(url, "http://my.local/").origin === "http://my.local";

const get_link = async (url, state) => {
  state.add_log({ get: url });
  const res = await state
    .req()
    .get(url)
    .set("Cookie", state.cookie)
    .set("Accept", "text/html");
  expect(toSucceed(state));
  //console.log(res.text);
  return await processResponse(res, url, state);
};

const genRandom = input => {
  //console.log(input)
  switch (input.attribs.type) {
    case "hidden":
      return input.attribs.value;
      break;
    case "text":
    case "email":
    case "password":
      return is.str.generate();
      break;
    case "checkbox":
      return is.bool.generate() ? "on" : undefined;
      break;
    case "number":
      return is.num.generate();
      break;
    default:
      //console.log(input);
      return is.str.generate();
  }
};

const genRandomSelect = input => {
  const options = input.children.map(e => e.attribs.value);
  return oneOf(options);
};

const submit_form = async (form, state) => {
  const action = form.attr("action");
  const method = (form.attr("method") || "post").toLowerCase();
  //console.log({ form });
  var body = {};

  const inputs = form.find("input").toArray();
  for (const input of inputs) {
    body[input.attribs.name] = encodeURIComponent(genRandom(input));
  }
  const selects = form.find("select").toArray();
  for (const select of selects) {
    body[select.attribs.name] = encodeURIComponent(genRandomSelect(select));
  }

  if (method === "post") {
    var req = state
      .req()
      .post(action)
      .set("Cookie", state.cookie);
    for (const [k, v] of Object.entries(body)) {
      const oldreq = req;
      if (typeof v !== "undefined") req = oldreq.send(`${k}=${v}`);
    }
    state.add_log({ post: action, body });
    const res = await req.expect(toSucceed(state));
    return await processResponse(res, action, state);
  } else if (method === "get") {
    const url =
      action +
      "?" +
      Object.entries(body)
        .map(([k, v]) => `${k}=${v}`)
        .join("&");

    state.add_log({ getForm: url });
    const res = await state
      .req()
      .get(url)
      .set("Cookie", state.cookie)
      .expect(toSucceed(state));
    return await processResponse(res, url, state);
  }
};

const rndElem = selection => {
  var random = Math.floor(Math.random() * selection.length);
  return selection.eq(random);
};

const processResponse = async (res, url, state) => {
  if (res.status === 302) {
    return await get_link(res.headers.location, state);
  }

  const $ = cheerio.load(res.text);

  var local_links = $("a[href]").filter((i, e) => isLocalURL(e.attribs.href));
  var forms = $("form").filter((i, e) =>
    state.check_form_action(e.attribs.action)
  );
  if (state.steps_remaining) {
    if (forms.length > 0 && local_links.length > 0)
      if (Math.random() < 0.4)
        return await get_link(rndElem(local_links).attr("href"), state.decr());
      else return await submit_form(rndElem(forms), state.decr());

    if (forms.length > 0)
      return await submit_form(rndElem(forms), state.decr());

    if (local_links.length > 0)
      return await get_link(rndElem(local_links).attr("href"), state.decr());
  } else return state;
};

const get_rnd_seed = () => `${Math.round(Math.random() * 10000)}`;

const set_seed = () => {
  const seed = process.env.JS_TEST_SEED || get_rnd_seed();
  seedrandom(seed, { global: true });
  return seed;
};

module.exports = { chaos_guinea_pig: run, set_seed };
