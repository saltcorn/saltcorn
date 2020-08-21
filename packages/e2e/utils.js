const puppeteer = require("puppeteer");
const { deleteTenant } = require("@saltcorn/data/models/tenant");
const db = require("@saltcorn/data/db");
const { resetToFixtures } = require("@saltcorn/server/auth/testhelp");
class Browser {
  static async init(o) {
    await resetToFixtures();
    const b = new Browser();
    b.browser = await puppeteer.launch({
      headless: true, //o || process.env.CI==='true',
      executablePath: "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      dumpio: true
    });

    b.page = await b.browser.newPage();
    //  await page.goto("http://localhost:3000/");
    b.page.on("pageerror", function(err) {
      theTempValue = err.toString();
      throw new Error("Page error: " + theTempValue);
    });
    b.page.on("error", function(err) {
      theTempValue = err.toString();
      throw new Error("Error: " + theTempValue);
    });
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
  async clickNav(sel, dontCheck) {
    const prevpage = await this.page.content();

    const [response] = await Promise.all([
      this.page.waitForNavigation(),
      this.page.click(sel)
    ]);
    if(response.status()>=400 && !dontCheck) {
      const page = await this.page.content();
      console.log("nav sel", sel)
      console.log("beforeNav", prevpage)
      console.log("afterNav", page)
    }
    if(!dontCheck)
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
    await this.page.click(selector);
    await this.page.waitFor(50);
    const inputValue = await this.page.$eval(selector, el => el.value);
    for (let i = 0; i < inputValue.length; i++) {
      await this.page.waitFor(10);
      await this.page.keyboard.press("Backspace");
    }
    await this.page.waitFor(20);
  }
  async slowly_type(selector, text) {
    await this.page.click(selector);
    await this.page.waitFor(50);
    for (let i = 0; i < text.length; i++) {
      await this.page.waitFor(20);
      await this.page.keyboard.press(text[i]);
    }
    await this.page.waitFor(50);
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
    await page.type("#inputemail", "tomtheuser@foo.bar");
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
