const puppeteer = require("puppeteer");
const { deleteTenant } = require("@saltcorn/data/models/tenant");
const db = require("@saltcorn/data/db");
class Browser {
  static async init(o) {
    const b = new Browser();
    b.browser = await puppeteer.launch({
      headless: o || process.env.CI==='true',
      executablePath: '/usr/bin/google-chrome'
    });
    b.page = await b.browser.newPage();
    //  await page.goto("http://localhost:3000/");
    return b;
  }
  async goto(url) {
    await Promise.all([
      this.page.waitForNavigation(),
      this.page.goto(
        `http://${this.tenant ? this.tenant + "." : ""}example.com:3000${url}`
      )
    ]);
  }
  async clickNav(sel) {
    await Promise.all([this.page.waitForNavigation(), this.page.click(sel)]);
  }

  async delete_tenant(nm) {
    this.tenant = undefined;
    await deleteTenant(nm);
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
  }

  async close() {
    await this.browser.close();
    await db.close();
  }
}

module.exports = { Browser };
