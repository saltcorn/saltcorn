const { test, expect } = require("@playwright/test");
const { baseURL, derivedURL } = require("../pageobject/base_url.js");

// example.test and its subdomains point to the local server
test.use({
  launchOptions: { args: ["--host-resolver-rules=MAP *example.test 127.0.0.1"] },
});

// the screen info cookie must stay on the site's own host (issue #4480)
test.describe("TC_45 Screen info cookie", () => {
  const screenCookies = async (context) =>
    (await context.cookies()).filter((c) => c.name === "_sc_screen_info_");

  test("TC_45-01 is host-only, lax, encoded and expires in a year", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setViewportSize({ width: 1350, height: 720 });
    await page.goto(baseURL + derivedURL);
    const cookies = await screenCookies(context);
    expect(cookies).toHaveLength(1);
    const [cookie] = cookies;
    expect(cookie.sameSite).toBe("Lax");
    // no quotes or commas in the raw value
    expect(cookie.value).not.toMatch(/["{},]/);
    expect(JSON.parse(decodeURIComponent(cookie.value))).toMatchObject({
      innerWidth: 1350,
      innerHeight: 720,
    });
    const days = (cookie.expires * 1000 - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(364);
    expect(days).toBeLessThan(366);
    await context.close();
  });

  test("TC_45-02 never reaches subdomains, the old shared cookie is removed", async ({
    browser,
  }) => {
    // a real domain, chromium makes every localhost cookie host-only
    const port = new URL(baseURL).port;
    const site = `http://example.test:${port}`;
    const sub = `http://app.example.test:${port}`;
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: "_sc_screen_info_",
        value: '{"width":1,"height":1}',
        domain: ".example.test",
        path: "/",
        expires: Date.parse("2100-01-01") / 1000,
      },
    ]);
    // stand in for another app on the subdomain, record the cookies it gets
    const page = await context.newPage();
    let subCookies;
    await page.route(`${sub}/**`, async (route) => {
      subCookies = (await route.request().allHeaders()).cookie || "";
      await route.fulfill({ body: "other app" });
    });
    const sentToSub = async () => {
      await page.goto(`${sub}/`);
      return subCookies;
    };
    expect(await sentToSub()).toContain("_sc_screen_info_");
    await page.goto(`${site}/auth/login`);
    const cookies = await screenCookies(context);
    expect(cookies.map((c) => c.domain)).toEqual(["example.test"]);
    expect(await sentToSub()).not.toContain("_sc_screen_info_");
    await context.close();
  });
});
