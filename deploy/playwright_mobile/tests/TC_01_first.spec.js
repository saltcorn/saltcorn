const { test, expect } = require("@playwright/test");

test.describe("Mobile Test Suite", () => {
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();
    await page.setViewportSize({ width: 1350, height: 720 });
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
  });

  test("open login page", async () => {
    await page.goto("http://localhost:3010/mobile_test_build/index.html");

    const iframe = page.frameLocator("iframe");
    try {
      await expect(iframe.locator('input[type="email"]')).toBeVisible();
      await expect(iframe.locator('input[type="password"]')).toBeVisible();
      await expect(iframe.locator('button[type="submit"]')).toBeVisible();
    } catch (error) {
      console.error("Test failed — dumping iframe HTML...");
      const iframeHandle = await page.locator("iframe").elementHandle();
      if (iframeHandle) {
        const contentFrame = await iframeHandle.contentFrame();
        if (contentFrame) {
          const html = await contentFrame.content();
          console.log("Iframe HTML content:\n", html);
        } else console.error("Could not get iframe contentFrame.");
      } else console.error("Could not get iframe element handle.");
      throw error;
    }
  });

  test("login with valid credentials", async () => {
    const iframe = page.frameLocator("iframe");

    await iframe.locator('input[type="email"]').fill("admin@foo.com");
    await iframe.locator('input[type="password"]').fill("AhGGr6rhu45");
    await iframe.locator('button[type="submit"]').click();

    await page.waitForTimeout(3000);

    const newIframe = page.frameLocator("iframe");

    await expect(
      newIframe.locator("#accordionSidebar h6.collapse-header")
    ).toHaveText("admin@foo.com");
    await expect(
      newIframe.locator('.card-body div[data-sc-embed-viewname="show_guitar"]')
    ).toHaveCount(5);
    await expect(
      newIframe.locator('button:has-text("Add guitar")')
    ).toBeVisible();
  });
});
