const puppeteer = require("puppeteer");
const { Browser } = require("./utils");

let browser;
jest.setTimeout(60 * 1000);

beforeAll(async () => {
  browser = await Browser.init();
});
/*
describe("Packs", () => {
  it("Installs blog pack", async () => {
    await browser.delete_tenant("sub2");
    await browser.create_tenant("sub2");
    await browser.install_pack("Blog");
  });

  it("Installs PM pack", async () => {
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
    const page = await browser.page.content();
    expect(page).toContain("Maths");
    expect(page).toContain("todokanban");
  });

  it("Installs issue tracker pack", async () => {
    await browser.delete_tenant("sub1");
    await browser.create_tenant("sub1");
    await browser.install_pack("Issue  tracker");
    await browser.clickNav(".card-body > div > a");
    await browser.page.type("#inputdescription", "my new task");
    await browser.page.type("#inputdetails", "some stuff");
    await browser.clickNav("button[type=submit]");
    await browser.clickNav("td > a");
  });
});


*/
describe("Table create", () => {
  it("creates tenant", async () => {
    await browser.delete_tenant("sub4");
    await browser.create_tenant("sub4");
    await browser.goto("/");
    const page = await browser.page.content();
    expect(page).toContain("You have no tables and no views!");
  })
  it("creates table", async () => {
    await browser.goto("/table/new");
    await browser.page.type("#inputname", "Persons");
    await browser.clickNav("button[type=submit]");
    const page = await browser.page.content();
    expect(page).toContain("No fields defined in Persons table")
  })
  it("creates string field", async () => {
    await browser.clickNav(".btn.add-field");
    await browser.page.type("#inputlabel", "Full name");
    await browser.page.select('#inputtype', 'String')
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("Field attributes")
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("Persons table")
  })
})
afterAll(async () => {
  await browser.delete_tenant("sub2");
  await browser.delete_tenant("sub3");
  await browser.delete_tenant("sub1");
  await browser.delete_tenant("sub4");
  await browser.close();
});
