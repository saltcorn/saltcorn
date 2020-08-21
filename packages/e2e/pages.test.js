const puppeteer = require("puppeteer");
const { Browser } = require("./utils");

let browser;
jest.setTimeout(60 * 1000);

beforeAll(async () => {
  browser = await Browser.init();
});

describe("Dotcom and db page page", () => {
  it("logs in", async () => {
    await browser.delete_tenant("sub4");
    await browser.goto("/auth/login");
    await browser.page.type("#inputemail", "admin@foo.com");
    await browser.page.type("#inputpassword", "secret");
    await browser.clickNav("button[type=submit]", true);
  });
  it("sets home page", async () => {
    await browser.goto("/config");
    await browser.goto("/config/edit/public_home");
    expect(await browser.content()).toContain("Public home page");
    await browser.page.type("#inputpublic_home", "a_page");
    await browser.clickNav("button[type=submit]");

    await browser.goto("/config/edit/admin_home");
    expect(await browser.content()).toContain("Admin home page");
    await browser.page.type("#inputadmin_home", "");
    await browser.clickNav("button[type=submit]");
    await browser.goto("/");
    const page = await browser.page.content();
    expect(page).toContain("Logout");
  });
  it("Logs out 1", async () => {
    await browser.goto("/auth/logout");
  });
  it("shows db page", async () => {
    await browser.goto("/");
    const page = await browser.content();
    expect(page).toContain(">Bye bye<");
  });
  it("logs back in", async () => {
    await browser.goto("/auth/login");
    await browser.page.type("#inputemail", "admin@foo.com");
    await browser.page.type("#inputpassword", "secret");
    await browser.clickNav("button[type=submit]");

    await browser.goto("/");
    const page = await browser.page.content();
    expect(page).toContain("Logout");
  });
  it("activates plugins", async () => {
    await browser.goto("/plugins");
    await browser.clickNav(
      'form[action="/plugins/install/plain-bootstrap-theme"] button'
    );
    expect(await browser.content()).toContain(
      "Plugin plain-bootstrap-theme installed"
    );
    await browser.goto("/plugins/new");
    await browser.page.type("#inputname", "saltcorn-dotcom-pages");
    await browser.page.select("#inputsource", "github");
    await browser.page.type(
      "#inputlocation",
      "glutamate/saltcorn-dotcom-pages"
    );
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain(
      "Plugin saltcorn-dotcom-pages installed"
    );
  });
  it("sets home page", async () => {
    await browser.goto("/config");
    await browser.goto("/config/edit/public_home");
    expect(await browser.content()).toContain("Public home page");
    await browser.erase_input("#inputpublic_home");
    await browser.page.type("#inputpublic_home", "root");
    await browser.clickNav("button[type=submit]");
  });
  it("Logs out 2", async () => {
    await browser.goto("/auth/logout");
  });
  it("displays root page", async () => {
    await browser.goto("/");
    const page = await browser.content();
    expect(page).toContain(
      "The Saltcorn wiki, issue tracker, blog and store are built with Saltcorn"
    );
  });
});

afterAll(async () => {
  await browser.close();
});
