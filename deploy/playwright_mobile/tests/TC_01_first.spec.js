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
    const submitButton = await iframe.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test("login with valid credentials", async () => {
    const iframeElement = await page.locator("iframe");
    const iframeHandle = await iframeElement.elementHandle();
    if (!iframeHandle) {
      throw new Error("Iframe not found");
    }
    const iframe = await iframeHandle.contentFrame();
    await iframe.locator('input[type="email"]').fill("admin@foo.com");
    await iframe.locator('input[type="password"]').fill("AhGGr6rhu45");
    await iframe.locator('button[type="submit"]').click();

    await page.waitForTimeout(3000);

    const newIframeElement = await page.locator("iframe");
    const newIframeHandle = await newIframeElement.elementHandle();
    if (!newIframeHandle) throw new Error("Iframe not found after login");
    const newIframe = await newIframeHandle.contentFrame();

    const sidebarUserEmail = newIframe.locator(
      "#accordionSidebar h6.collapse-header"
    );
    await expect(sidebarUserEmail).toHaveText("admin@foo.com");

    const guitars = newIframe.locator(
      '.card-body div[data-sc-embed-viewname="show_guitar"]'
    );
    await expect(guitars).toHaveCount(5);

    const addButton = newIframe.locator('button:has-text("Add guitar")');
    await expect(addButton).toBeVisible();
  });
});
