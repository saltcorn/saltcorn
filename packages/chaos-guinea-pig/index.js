const request = require("supertest");
const cheerio = require('cheerio')

const toSucceed = res => {
  if (res.statusCode >= 400) {
    console.log(res.text);
    throw new Error(`Received ${res.statusCode}`);
  }
};

const run = async (app, options = {}) => {
  const startAt = options.startAt || "/";
  await step(app, startAt);
};

const step = async (app, url) => {
  console.log("Checking page", url);
  const res = await request(app)
    .get(url)
    .set('Accept', 'text/html');
    //.expect(toSucceed);
  console.log(res.text)

    //const $ = cheerio.load(res.text)
    //console.log($('link').html())
    //console.log($.html())
  return;
};

module.exports = run;
