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
    await page.goto("http://localhost:3000/mobile_test_build/index.html");
    const iframeElement = await page.locator("iframe");
    const iframeHandle = await iframeElement.elementHandle();
    if (!iframeHandle) {
      throw new Error("Iframe not found");
    }
    const iframe = await iframeHandle.contentFrame();
    const emailInput = await iframe.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    const passwordInput = await iframe.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
  });
});
