const puppeteer = require("puppeteer");
const { Browser } = require("./utils");

let browser;
jest.setTimeout(60 * 1000);

beforeAll(async () => {
  browser = await Browser.init();
});


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
    await browser.page.type("#inputmin", "3");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("Persons table");

  })

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
    await browser.goto("/view/PersonList");
    expect(await browser.content()).toContain("PersonList view");
  });
  it("edits view", async () => {
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
  it("installs plugins", async () => {
    await browser.goto("/plugins");
    //second time should be cached
    await browser.goto("/plugins");
    expect(await browser.content()).toContain('action="/plugins/install/markdown"');
    await browser.clickNav('form[action="/plugins/install/markdown"] button');
    expect(await browser.content()).toContain('startbootstrap-sb-admin-2');
    await browser.clickNav('form[action="/plugins/install/plain-bootstrap-theme"] button');
    expect(await browser.content()).not.toContain('startbootstrap-sb-admin-2');
  })
  it("Changes site name", async () => {
    await browser.goto("/config");
    expect(await browser.content()).toContain('Site name');
    expect(await browser.content()).toContain('"Saltcorn"');
    await browser.goto("/config/edit/site_name");
    await browser.page.type("#inputsite_name", "MyFabSite");
    await browser.clickNav("button[type=submit]");
    await browser.goto("/");
    expect(await browser.content()).toContain("MyFabSite");

  })
});
afterAll(async () => {
  await browser.delete_tenant("sub4");
  await browser.close();
});
