const puppeteer = require("puppeteer");

class Browser {
    static async init(o) {
        const b = new Browser()
        b.browser = await puppeteer.launch({
            headless: false
          });
        b.page = await b.browser.newPage();
        //  await page.goto("http://localhost:3000/");
        return b
    }
}

module.exports = {Browser}