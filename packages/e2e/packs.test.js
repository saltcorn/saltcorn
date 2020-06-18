const puppeteer = require("puppeteer");
const { Browser } = require("./utils");

let browser;

// 2
beforeAll(async () => {
  browser = await Browser.init();
  //await browser.page.goto("http://localhost:3000/");
});

describe("Packs", () => {
  it("Installs blog pack", async () => {
    await browser.create_tenant("sub2");
    await browser.install_pack("Blog");
  });
  it("Installs PM pack", async () => {
    await browser.create_tenant("sub3");
    await browser.install_pack("Project management");
  });
  it("Installs issue tracker pack", async () => {
    await browser.create_tenant("sub1");
    await browser.install_pack("Issue  tracker");
    await browser.clickNav(".card-body > div > a")
    await browser.page.type("#inputdescription", "my new task");
    await browser.page.type("#inputdetails", "some stuff");
    await browser.clickNav("button[type=submit]");
    await browser.clickNav("td > a");
  });
  afterEach(async () => {
    await browser.delete_tenant("sub2");
    await browser.delete_tenant("sub3");
    await browser.delete_tenant("sub1");
    await browser.delete_tenant("sub4");
  })
});

/*test("renders body", async () => {
  //await browser.page.waitForSelector("body");
  await browser.create_tenant("sub4");
});*/

afterAll(async () => {
    await browser.delete_tenant("sub2");
    await browser.delete_tenant("sub3");
    await browser.delete_tenant("sub1");
    await browser.delete_tenant("sub4");
    await browser.close();
});
