const puppeteer = require("puppeteer");
const { Browser } = require("./utils")

let browser;

// 2
beforeAll(async () => {
  browser = await Browser.init()
  await browser.page.goto("http://localhost:3000/");
});

test("renders body", async () => {
    await browser.page.waitForSelector("body");
})

afterAll(() => {
    browser.browser.close();
  });