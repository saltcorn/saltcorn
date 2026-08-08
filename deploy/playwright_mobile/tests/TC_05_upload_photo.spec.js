const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { dumpHTML } = require("./helpers");

const FAKE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test.describe("Upload photo edit view", () => {
  let context;
  let page;
  let testFilePath;

  test.beforeAll(async ({ browser }) => {
    testFilePath = path.join(os.tmpdir(), "test-photo.png");
    fs.writeFileSync(testFilePath, Buffer.from(FAKE_PNG_BASE64, "base64"));

    context = await browser.newContext({
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();
    await page.setViewportSize({ width: 1350, height: 720 });
    await page.goto("http://localhost:3010/mobile_test_build/index.html");
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
    fs.rmSync(testFilePath, { force: true });
  });

  test("login with valid credentials", async () => {
    try {
      const iframe = page.frameLocator("iframe");
      await iframe.locator('input[type="email"]').fill("admin@foo.com");
      await iframe.locator('input[type="password"]').fill("AhGGr6rhu45");
      await iframe.locator('button[type="submit"]').click();
      await page.waitForTimeout(1500);
      const newIframe = page.frameLocator("iframe");
      const toast = newIframe.locator(".toast .toast-body");
      await expect(toast).toHaveText(/Welcome, admin@foo.com!/i);
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("open the upload_photo view", async () => {
    try {
      // go straight to the view, no link/page needed to reach it
      await page.evaluate(async () => {
        await window.saltcorn.mobileApp.navigation.handleRoute(
          "get/view/upload_photo"
        );
      });
      await page.waitForTimeout(1000);
      const iframe = page.frameLocator("iframe");
      await expect(iframe.locator('input[type="file"]')).toBeVisible();
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("upload a photo creates a row", async () => {
    try {
      const rowsBefore = await page.request
        .get("http://localhost:3010/api/photos")
        .then((res) => res.json());

      const iframe = page.frameLocator("iframe");
      await iframe.locator('input[type="file"]').setInputFiles(testFilePath);
      await iframe.locator('button[type="submit"]').click();
      await page.waitForTimeout(1500);

      const rowsAfter = await page.request
        .get("http://localhost:3010/api/photos")
        .then((res) => res.json());
      expect(rowsAfter.success.length).toBe(rowsBefore.success.length + 1);

      const newRow = rowsAfter.success.find(
        (r) => !rowsBefore.success.some((old) => old.id === r.id)
      );
      expect(newRow.photo).toBeTruthy();
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });
});
