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
  });
  it("creates table", async () => {
    await browser.goto("/table/new");
    await browser.page.type("#inputname", "Persons");
    await browser.clickNav("button[type=submit]");
    const page = await browser.page.content();
    expect(page).toContain("No fields defined in Persons table");
  });
  it("creates string field", async () => {
    await browser.clickNav(".btn.add-field");
    await browser.page.type("#inputlabel", "Full name");
    await browser.page.select("#inputtype", "String");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("Field attributes");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("Persons table");
  });
  it("creates int field", async () => {
    await browser.clickNav(".btn.add-field");
    expect(await browser.content()).toContain("New field");
    await browser.page.type("#inputlabel", "Age");
    await browser.page.select("#inputtype", "Integer");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("Field attributes");
    await browser.page.type("#inputmin", "0");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("Persons table");
  });

  it("creates and deletes field", async () => {
    await browser.clickNav(".btn.add-field");
    await browser.page.type("#inputlabel", "Useless");
    await browser.page.select("#inputtype", "String");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("Field attributes");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("Persons table");
    expect(await browser.content()).toContain("Useless");
    await browser.clickNav("tr:nth-child(3) button");
    expect(await browser.content()).toContain("Persons table");
    expect(await browser.content()).not.toContain("Useless");
  });
  it("shows data", async () => {
    await browser.goto("/list/Persons");
  });
  it("creates view", async () => {
    await browser.goto("/viewedit");
    expect(await browser.content()).toContain("Add view");
    await browser.goto("/viewedit/new");
    await browser.page.type("#inputname", "PersonList");
    await browser.page.select("#inputviewtemplate", "List");
    await browser.page.select("#inputtable_name", "Persons");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain(
      "Specify the fields in the table to show"
    );
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("Add view");
    expect(await browser.content()).toContain("PersonList");
  });
  it("edits view", async () => {
    await browser.goto("/viewedit/edit/PersonList");
    expect(await browser.content()).toContain("PersonList");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain(
      "Specify the fields in the table to show"
    );
    await browser.clickNav("button[type=submit]");
  });
});
afterAll(async () => {
  await browser.delete_tenant("sub2");
  await browser.delete_tenant("sub3");
  await browser.delete_tenant("sub1");
  await browser.delete_tenant("sub4");
  await browser.close();
});
