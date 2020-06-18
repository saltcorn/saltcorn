const puppeteer = require("puppeteer");

let browser;
let page;

// 2
beforeAll(async () => {
  browser = await puppeteer.launch({
    headless: false
  });
  page = await browser.newPage();
  await page.goto("http://localhost:3000/");
});

test("renders body", async () => {
    await page.waitForSelector("body");
})

afterAll(() => {
    browser.close();
  });