const request = require("supertest");
const cheerio = require("cheerio");
const CrawlState = require("./crawl-state");

const toSucceed = res => {
  if (res.statusCode >= 400) {
    console.log(res.text);
    throw new Error(`Received ${res.statusCode}`);
  }
};

const run = async (app, options = {}) => {
  const startAt = options.startAt || "/";
  const state = new CrawlState();
  await step(app, startAt, state);
};

const step = async (app, url, state) => {
  console.log("Checking page", url);
  const res = await request(app)
    .get(url)
    .set("Accept", "text/html");
  expect(toSucceed);
  console.log(res.text);

  const $ = cheerio.load(res.text);
  for(const link of $("link").toArray()) {
    await state.check_link(link);
};
  //console.log($.html())
  return;
};

module.exports = run;
