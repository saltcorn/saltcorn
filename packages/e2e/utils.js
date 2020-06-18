const puppeteer = require("puppeteer");
const { deleteTenant } = require("@saltcorn/data/models/tenant");
const db = require("@saltcorn/data/db");
class Browser {
    static async init(o) {
        const b = new Browser()
        b.browser = await puppeteer.launch({
            headless: o||false
          });
        b.page = await b.browser.newPage();
        //  await page.goto("http://localhost:3000/");
        return b
    }
    async goto(url) {
        //await this.page.goto(`http://${this.tenant?this.tenant+'.':'' }example.com:3000${url}`);
        await this.page.goto(`http://localhost:3000${url}`);
    }
    async delete_tenant(nm) {
        await deleteTenant(nm)
    }
    async create_tenant(nm) {
        this.tenant=undefined;
        this.goto('/tenant/create')
        

        const page=this.page;await page.waitForNavigation();
        await page.waitForSelector('form #inputsubdomain')
        await page.click('form #inputsubdomain')
        await page.type('form #inputsubdomain', nm);
        await page.click('button[type=submit]');
        //await page.waitForNavigation();
    }
    async close() {
        await this.browser.close()
        await db.close()
    }
}

module.exports = {Browser}