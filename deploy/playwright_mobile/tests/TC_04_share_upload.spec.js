const { test, expect } = require("@playwright/test");

const { dumpHTML } = require("./helpers");

// This test runs in a browser, not a real phone, so there's no share menu to
// trigger. It calls postShare() directly and fakes the file read with PNG bytes.
const FAKE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test.describe("Mobile share upload", () => {
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
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

  test("share a link", async () => {
    try {
      await page.evaluate(async () => {
        await window.saltcorn.mobileApp.postShare({
          title: "Example Domain",
          description: "",
          type: "text/plain",
          url: "https://example.com/",
        });
      });
      await page.waitForTimeout(1500);
      const iframe = page.frameLocator("iframe");
      await expect(iframe.locator(".fa-check")).toBeVisible();
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("share a file creates a photos row", async () => {
    try {
      const rowsBefore = await page.request
        .get("http://localhost:3010/api/photos")
        .then((res) => res.json());

      await page.evaluate(async (pngBase64) => {
        // fake file read, since there's no real file to read in a browser
        window.Capacitor.Plugins.Filesystem = {
          readFile: async () => ({ data: pngBase64 }),
        };
        await window.saltcorn.mobileApp.postShare({
          title: "test-photo.jpg",
          description: "",
          type: "image/jpeg",
          url: "file:///fake/test-photo.jpg",
        });
      }, FAKE_PNG_BASE64);

      // postShare() already waited for the result page to render, so check
      // right away - the app redirects back to the dashboard after 4s
      const iframe = page.frameLocator("iframe");
      await expect(iframe.locator(".fa-check")).toBeVisible({ timeout: 2000 });

      const rowsAfter = await page.request
        .get("http://localhost:3010/api/photos")
        .then((res) => res.json());
      expect(rowsAfter.success.length).toBe(rowsBefore.success.length + 1);

      const newRow = rowsAfter.success.find(
        (r) => !rowsBefore.success.some((old) => old.id === r.id)
      );
      expect(newRow.photo).toContain("test-photo");
      expect(newRow.inserted_at).toBeTruthy();
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });
});
