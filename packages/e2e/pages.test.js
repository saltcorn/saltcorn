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
    await browser.page.type("#inputpassword", "AhGGr6rhu45");
    await browser.clickNav("button[type=submit]", true);
  });
  it("sets home page", async () => {
    await browser.goto("/pageedit");
    //await browser.goto("/config/edit/public_home");
    expect(await browser.content()).toContain("Root pages");
    await browser.page.select("#inputpublic", "a_page");
    await browser.clickNav("button[type=submit]");
    expect(await browser.content()).toContain("Root pages updated");
    await browser.goto("/");
    const page = await browser.page.content();
    expect(page).toContain("Logout");
  });
  it("Logs out 1", async () => {
    await browser.goto("/auth/logout");
  });
  it("shows db page", async () => {
    await browser.page.waitFor(1000);
    await browser.goto("/");
    const page = await browser.content();
    expect(page).toContain(">Bye bye<");
  });
  it("logs back in", async () => {
    await browser.goto("/auth/login");
    await browser.page.type("#inputemail", "admin@foo.com");
    await browser.page.type("#inputpassword", "AhGGr6rhu45");
    await browser.clickNav("button[type=submit]");

    await browser.goto("/");
    const page = await browser.page.content();
    expect(page).toContain("Logout");
  });
  it("activates plugins", async () => {
    await browser.goto("/plugins");
    await browser.clickNav(
      'form[action="/plugins/install/any-bootstrap-theme"] button'
    );
    expect(await browser.content()).toContain(
      "Plugin any-bootstrap-theme installed"
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
});

afterAll(async () => {
  await browser.close();
});
