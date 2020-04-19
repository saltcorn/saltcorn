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
  await step(app, startAt, state, options.steps || 10);
};

const step = async (app, url, state, steps_left) => {
  console.log("Checking page", url);
  const res = await request(app)
    .get(url)
    .set("Accept", "text/html");
  expect(toSucceed);
  //console.log(res.text);

  const $ = cheerio.load(res.text);

  var local_links = [];
  for (const a of $("a[href]").toArray()) {
    const url = new URL(a.attribs.href, "http://my.local/");
    if (url.origin === "http://my.local") {
      local_links.push(a.attribs.href);
    }
  }
  if (steps_left && local_links.length > 0) {
    return await step(app, oneOf(local_links), state, steps_left - 1);
  } else return;
};

module.exports = run;
