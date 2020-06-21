const puppeteer = require("puppeteer");
const { deleteTenant } = require("@saltcorn/data/models/tenant");
const db = require("@saltcorn/data/db");
class Browser {
  static async init(o) {
    const b = new Browser();
    b.browser = await puppeteer.launch({
      headless: true, //o || process.env.CI==='true',
      executablePath: "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      dumpio: true
    });

    b.page = await b.browser.newPage();
    //  await page.goto("http://localhost:3000/");

    return b;
  }

  get baseURL() {
    return `http://${this.tenant ? this.tenant + "." : ""}example.com:2987`;
  }
  async goto(url) {
    const [response] = await Promise.all([
      this.page.waitForNavigation(),
      this.page.goto(this.baseURL + url)
    ]);
    expect(response.status()).toBe(200);
  }
  async clickNav(sel) {
    const [response] = await Promise.all([
      this.page.waitForNavigation(),
      this.page.click(sel)
    ]);
    expect(response.status()).toBeLessThanOrEqual(399);
  }
  content() {
    return this.page.content();
  }
  async delete_tenant(nm) {
    this.tenant = undefined;
    await deleteTenant(nm);
  }

  // https://stackoverflow.com/a/52633235
  async erase_input(selector) {
    await this.page.click(selector)
    const inputValue = await this.page.$eval(selector, el => el.value);
    for (let i = 0; i < inputValue.length; i++) {
      await this.page.keyboard.press('Backspace');
    }
  }
  async create_tenant(nm) {
    if (typeof this.tenant !== "undefined")
      throw new Error("tenant not deleted");
    await this.goto("/tenant/create");

    const page = this.page;
    await page.waitForSelector("form #inputsubdomain");
    await page.click("form #inputsubdomain");
    await page.type("form #inputsubdomain", nm);
    await this.clickNav("button[type=submit]");
    await page.waitForSelector("a.new-tenant-link");
    this.tenant = nm;
    await this.goto("/");
    await page.type("#inputemail", "tom@foo.bar");
    await page.type("#inputpassword", "secret");
    await this.clickNav("button[type=submit]");
    await page.waitForSelector('a[href="/table/new"]');
  }

  async install_pack(pack) {
    await this.goto("/plugins");
    await this.clickNav(
      `form[action="/packs/install-named/${encodeURIComponent(
        pack
      )}"] button[type=submit]`
    );
    const url = await this.page.url();
    expect(url).toBe(this.baseURL + "/");
  }

  async close() {
    await this.browser.close();
    await db.close();
  }
}

module.exports = { Browser };
