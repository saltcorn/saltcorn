const { test, expect } = require("@playwright/test");

const { dumpHTML } = require("./helpers");

// Regression tests: embedded Delete/Toggle links used to get their own
// <form> dropped when nested in create_guitar's form; now plain <a onclick>.
test.describe("Embedded action buttons nested inside another view's form", () => {
  let context;
  let page;
  let testGuitarId;
  let processedRowId;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();
    page.on("console", (msg) => console.log("BROWSER:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGEERROR:", err.message));
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

  test("setup: create a fresh guitar", async () => {
    try {
      const rowsBefore = await page.request
        .get("http://localhost:3010/api/guitars")
        .then((res) => res.json());

      await page.evaluate(async () => {
        await window.saltcorn.mobileApp.navigation.handleRoute(
          "get/view/create_guitar"
        );
      });
      await page.waitForTimeout(1000);

      const iframe = page.frameLocator("iframe");
      await iframe.locator("#inputname").fill("Embedded-action test guitar");
      await iframe
        .locator("#inputdescription")
        .fill("created by TC_07 for the embedded action tests");
      await iframe.locator('button[type="submit"]').click();
      await page.waitForTimeout(1500);

      const rowsAfter = await page.request
        .get("http://localhost:3010/api/guitars")
        .then((res) => res.json());
      const created = rowsAfter.success.find(
        (r) => !rowsBefore.success.some((old) => old.id === r.id)
      );
      expect(created).toBeTruthy();
      testGuitarId = created.id;
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("setup: add one processed record via edit_guitar_process", async () => {
    try {
      const rowsBefore = await page.request
        .get("http://localhost:3010/api/processed")
        .then((res) => res.json());

      await page.evaluate(async () => {
        await window.saltcorn.mobileApp.navigation.handleRoute(
          "get/view/edit_guitar_process"
        );
      });
      await page.waitForTimeout(1000);

      const iframe = page.frameLocator("iframe");
      await iframe
        .locator('select[name="guitar"]')
        .selectOption(String(testGuitarId));
      await iframe.locator('select[name="type"]').selectOption("2");

      const dateInput = iframe.locator('input[type="text"]');
      await expect(dateInput).toBeVisible();
      await dateInput.click();
      const calendar = iframe.locator(".flatpickr-calendar.open");
      await expect(calendar).toBeVisible();
      const today = calendar.locator(".flatpickr-day.today");
      await today.click();

      await iframe.locator('button[type="submit"]').click();
      await page.waitForTimeout(1500);

      const rowsAfter = await page.request
        .get("http://localhost:3010/api/processed")
        .then((res) => res.json());
      const inserted = rowsAfter.success.find(
        (r) => !rowsBefore.success.some((old) => old.id === r.id)
      );
      expect(inserted).toBeTruthy();
      expect(inserted.guitar).toBe(testGuitarId);
      processedRowId = inserted.id;
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("embedded action buttons render with no wrapping <form>", async () => {
    try {
      // fresh navigation - not patched into an already-open page
      await page.evaluate(async (id) => {
        await window.saltcorn.mobileApp.navigation.handleRoute(
          "get/view/create_guitar",
          `id=${id}`
        );
      }, testGuitarId);
      await page.waitForTimeout(1500);

      const iframe = page.frameLocator("iframe");
      const embed = iframe.locator('[data-sc-embed-viewname="list_processed"]');
      await expect(embed).toBeVisible();
      const row = embed.locator(`tr[data-row-id="${processedRowId}"]`);
      await expect(row).toBeVisible();

      // the actual regression check
      await expect(embed.locator("form")).toHaveCount(0);

      const deleteLink = row.locator("a", { hasText: "Delete" });
      await expect(deleteLink).toHaveAttribute(
        "onclick",
        new RegExp(`/delete/processed/${processedRowId}\\b`)
      );
      const toggleLink = row.locator("a", { hasText: "Toggle verified" });
      await expect(toggleLink).toHaveAttribute(
        "onclick",
        new RegExp(`/edit/toggle/processed/${processedRowId}/verified\\b`)
      );

      // NOTE: click-through is blocked by a separate bug - mobile rendering
      // drops the required "post/" prefix (reproduces unembedded too)
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });
});
