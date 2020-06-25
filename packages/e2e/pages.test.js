const puppeteer = require("puppeteer");
const { Browser } = require("./utils");

let browser;
jest.setTimeout(60 * 1000);

beforeAll(async () => {
  browser = await Browser.init();
});

describe("Dotcom page", () => {
  it("creates tenant", async () => {
    await browser.delete_tenant("sub4");
    await browser.create_tenant("sub4");
    await browser.goto("/");
    const page = await browser.page.content();
    expect(page).toContain("You have no tables and no views!");
  });
  it("activates plugins", async ()=>{
    await browser.goto("/plugins");
    await browser.clickNav('form[action="/plugins/install/plain-bootstrap-theme"] button');
    expect(await browser.content()).toContain("Plugin plain-bootstrap-theme installed");
    await browser.goto("/plugins/new");
    await browser.page.type("#inputname", "saltcorn-dotcom-pages");
    await browser.page.select("#inputsource", "github");
    await browser.page.type("#inputlocation", "glutamate/saltcorn-dotcom-pages");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("Plugin saltcorn-dotcom-pages installed");
  })
  it("sets home page", async ()=>{
    await browser.goto("/config");
    await browser.goto("/config/edit/public_home");
    await browser.page.type("#inputpublic_home", "root");
  })
  it("Logs out", async () => {
    await browser.goto("/auth/logout");
    await browser.goto("/");
    const page = await browser.content();
    expect(page).toContain("The Saltcorn wiki, issue tracker, blog and store are built with Saltcorn");
  })
});
describe("database page", () => {
    it("creates tenant", async () => {
      await browser.delete_tenant("sub4");
      await browser.create_tenant("sub4");
      await browser.goto("/");
      const page = await browser.page.content();
      expect(page).toContain("You have no tables and no views!");
    });

    it("sets home page", async ()=>{
      await browser.goto("/config");
      await browser.goto("/config/edit/public_home");
      await browser.page.type("#inputpublic_home", "a_page");
    })
    it("Logs out", async () => {
      await browser.goto("/auth/logout");
      await browser.goto("/");
      const page = await browser.content();
      expect(page).toContain(">Bye bye<");
    })
  });
afterAll(async () => {
  await browser.close();
});
