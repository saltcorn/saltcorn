const puppeteer = require("puppeteer");
const { Browser } = require("./utils");

let browser;
jest.setTimeout(60 * 1000);

beforeAll(async () => {
  browser = await Browser.init();
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
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
  it("edits int field", async () => {
    await browser.goto("/field/2");
    expect(await browser.content()).toContain("Edit field");
    await browser.clickNav("button[type=submit]");
    await browser.erase_input("#inputmin");
    await browser.page.type("#inputmin", "3");
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
  it("creates list view", async () => {
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
    await browser.goto("/view/PersonList");
    expect(await browser.content()).toContain("PersonList view");
  });
  it("edits list view", async () => {
    await browser.goto("/viewedit/edit/PersonList");
    expect(await browser.content()).toContain("PersonList");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain(
      "Specify the fields in the table to show"
    );
    await browser.clickNav("button[type=submit]");
    await browser.goto("/view/PersonList");
    expect(await browser.content()).toContain("PersonList view");
  });
  it("creates edit view", async () => {
    await browser.goto("/viewedit");
    expect(await browser.content()).toContain("Add view");
    await browser.goto("/viewedit/new");
    await browser.page.type("#inputname", "PersonEdit");
    await browser.page.select("#inputviewtemplate", "Edit");
    await browser.page.select("#inputtable_name", "Persons");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("View canvas");
    await browser.page.click("span.is-text");
    await browser.page.waitForSelector("input.text-to-display");
    await browser.erase_input("input.text-to-display");
    await browser.page.type("input.text-to-display", "MyOwnInput");

    await browser.clickNav("button.btn-primary");
    await browser.clickNav("button[type=submit]");

    expect(await browser.content()).toContain("Add view");
    expect(await browser.content()).toContain("PersonEdit");
  });

  it("creates row with edit view", async () => {
    await browser.goto("/view/PersonEdit");
    expect(await browser.content()).toContain("PersonEdit view");
    expect(await browser.content()).toContain(
      '<span class="">MyOwnInput</span>'
    );
    await browser.page.type("#inputfull_name", "TomNook");
    await browser.page.type("#inputage", "19");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("PersonList view");
    expect(await browser.content()).toContain("TomNook");
  });
  it("edits row with edit view", async () => {
    await browser.goto("/view/PersonEdit?id=1");
    expect(await browser.content()).toContain("PersonEdit view");
    expect(await browser.content()).toContain("TomNook");
    await browser.erase_input("#inputfull_name");
    await browser.page.type("#inputfull_name", "TerryTheBeaver");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("PersonList view");
    expect(await browser.content()).toContain("TerryTheBeaver");
    expect(await browser.content()).not.toContain("TomNook");
  });
  it("creates show view", async () => {
    await browser.goto("/viewedit");
    expect(await browser.content()).toContain("Add view");
    await browser.goto("/viewedit/new");
    await browser.page.type("#inputname", "PersonShow");
    await browser.page.select("#inputviewtemplate", "Show");
    await browser.page.select("#inputtable_name", "Persons");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("View canvas");
    await browser.page.click("span.is-text");
    await browser.page.waitForSelector("input.text-to-display");
    await browser.erase_input("input.text-to-display");
    await browser.page.type("input.text-to-display", "MyOtherInput");

    await browser.clickNav("button.btn-primary");

    expect(await browser.content()).toContain("Add view");
    expect(await browser.content()).toContain("PersonShow");
    await browser.goto("/view/PersonShow?id=1");
    expect(await browser.content()).toContain("PersonShow view");
    expect(await browser.content()).toContain(
      '<span class="">MyOtherInput</span>'
    );
    expect(await browser.content()).toContain("TerryTheBeaver");
  });
  it("goto edit after show", async () => {
    await browser.goto("/view/PersonEdit?id=1");

    await browser.goto("/view/PersonEdit");
    expect(await browser.content()).toContain("PersonEdit view");
  })

  // tie views together
  // see data in list and show and edit
  // add required field
  // files?
  it("installs plugins", async () => {
    await browser.goto("/plugins");
    //second time should be cached
    await browser.goto("/plugins");
    expect(await browser.content()).toContain(
      'action="/plugins/install/markdown"'
    );
    await browser.clickNav('form[action="/plugins/install/markdown"] button');
    expect(await browser.content()).toContain("startbootstrap-sb-admin-2");
    await browser.clickNav(
      'form[action="/plugins/install/plain-bootstrap-theme"] button'
    );
    expect(await browser.content()).not.toContain("startbootstrap-sb-admin-2");
  });
  it("Changes site name", async () => {
    await browser.goto("/config");
    expect(await browser.content()).toContain("Site name");
    expect(await browser.content()).toContain('"Saltcorn"');
    await browser.goto("/config/edit/site_name");
    await browser.page.type("#inputsite_name", "MyFabSite");
    await browser.clickNav("button[type=submit]");
    await browser.goto("/");
    expect(await browser.content()).toContain("MyFabSite");
  });
  //logout, see list
  //sign up
  //logout, login
});
afterAll(async () => {
  await browser.delete_tenant("sub4");
  await browser.close();
});
