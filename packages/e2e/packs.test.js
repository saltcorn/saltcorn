const puppeteer = require("puppeteer");
const { Browser } = require("./utils");

let browser;

// 2
beforeAll(async () => {
  browser = await Browser.init();
  //await browser.page.goto("http://localhost:3000/");
});

test("renders body", async () => {
  //await browser.page.waitForSelector("body");
  await browser.create_tenant("sub2");
});

afterAll(async () => {
  await browser.delete_tenant("sub2");

  await browser.close();
});
