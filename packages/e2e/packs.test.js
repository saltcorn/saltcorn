const puppeteer = require("puppeteer");
const { Browser } = require("./utils");

let browser;

// 2
beforeAll(async () => {
  console.log("start beforeall")

  browser = await Browser.init();
  //await browser.page.goto("http://localhost:3000/");
  console.log("done beforeall")

});

describe("Packs", () => {
  it("Installs blog pack", async () => {
  console.log("start blog")
    
    await browser.delete_tenant("sub2");
    await browser.create_tenant("sub2");
    await browser.install_pack("Blog");
  });
  it("Installs PM pack", async () => {
  console.log("start pm")

    await browser.delete_tenant("sub3");
    await browser.create_tenant("sub3");
    await browser.install_pack("Project management");
    await browser.clickNav(".col-sm-6 > a");
    await browser.page.type("#inputname", "Homework");
    await browser.clickNav("button[type=submit]");
    await browser.clickNav("#todos > a");
    await browser.page.type("#inputdescription", "Maths");
    await browser.clickNav("button[type=submit]");
    await browser.clickNav(".nav-item:nth-child(6) span");
    const page = await browser.page.content()
    expect(page).toContain('Maths')
    expect(page).toContain('todoanban')


  });
  it("Installs issue tracker pack", async () => {
  console.log("start issue")

  await browser.delete_tenant("sub1");

    await browser.create_tenant("sub1");
    await browser.install_pack("Issue  tracker");
    await browser.clickNav(".card-body > div > a")
    await browser.page.type("#inputdescription", "my new task");
    await browser.page.type("#inputdetails", "some stuff");
    await browser.clickNav("button[type=submit]");
    await browser.clickNav("td > a");
  });
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
