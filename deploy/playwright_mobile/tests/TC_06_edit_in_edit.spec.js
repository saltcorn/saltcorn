const { test, expect } = require("@playwright/test");

const { dumpHTML } = require("./helpers");

// Regression tests for three mobile-only bugs:
// - auto_save's onChange called saveAndContinueDelayed, undefined on mobile
// - edit-in-edit child-row insert/update bypassed the query system, writing locally
// - the "SubmitWithAjax" button called submitWithAjax, also undefined on mobile
test.describe("Edit-in-edit auto-save and SubmitWithAjax", () => {
  let context;
  let page;
  // created fresh so its rows don't depend on what earlier files did to guitar 2
  let testGuitarId;

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

  test("setup: create a fresh guitar for the edit-in-edit tests", async () => {
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
      await iframe.locator("#inputname").fill("Edit-in-edit test guitar");
      await iframe.locator("#inputdescription").fill("created by TC_06");
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

  test("edit-in-edit: auto-save inserts a new child row on the server", async () => {
    try {
      await page.evaluate(async (id) => {
        await window.saltcorn.mobileApp.navigation.handleRoute(
          "get/view/create_guitar",
          `id=${id}`
        );
      }, testGuitarId);
      await page.waitForTimeout(1500);

      const iframe = page.frameLocator("iframe");
      // zero rows still renders one unfilled "_0" template row - fill that
      // directly; clicking Add too would submit a second, empty row_1
      const typeInput = iframe.locator('select[name="type_0"]');
      await expect(typeInput).toBeVisible();
      await typeInput.selectOption("2");

      // no Save click - relies on saveAndContinueDelayed + tryInsertChildQuery
      await page.waitForTimeout(2000);

      const rows = await page.request
        .get("http://localhost:3010/api/processed")
        .then((res) => res.json());
      const inserted = rows.success.find((r) => r.guitar === testGuitarId);
      expect(inserted).toBeTruthy();
      expect(inserted.type).toBe(2);
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("edit-in-edit: auto-save updates an existing child row on the server", async () => {
    try {
      // reload so id_0 is populated with the row the previous test inserted
      await page.evaluate(async (id) => {
        await window.saltcorn.mobileApp.navigation.handleRoute(
          "get/view/create_guitar",
          `id=${id}`
        );
      }, testGuitarId);
      await page.waitForTimeout(1500);

      const iframe = page.frameLocator("iframe");
      const firstRow = iframe.locator(".repeat-guitar").first();
      // altInput:true hides name="date_0" and adds an unnamed visible input
      const dateInput = firstRow.locator('input[type="text"]');
      await expect(dateInput).toBeVisible();
      await dateInput.click();

      // scope to the one open calendar - closed instances stay in the DOM too
      const calendar = iframe.locator(".flatpickr-calendar.open");
      await expect(calendar).toBeVisible();
      const yearInput = calendar.locator(".numInput.cur-year");
      await yearInput.fill("2026");
      await yearInput.press("Enter");
      const monthSelect = calendar.locator(
        "select.flatpickr-monthDropdown-months"
      );
      await monthSelect.selectOption("8"); // September (0-indexed)
      const dayToSelect = calendar.locator(
        '.flatpickr-day[aria-label="September 1, 2026"]'
      );
      await dayToSelect.click();

      // again, no Save button - only the auto_save onChange handler
      await page.waitForTimeout(2000);

      const rows = await page.request
        .get("http://localhost:3010/api/processed")
        .then((res) => res.json());
      const row = rows.success.find((r) => r.guitar === testGuitarId);
      expect(row.date).toBe("2026-09-01");
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("SubmitWithAjax: submits a new process_type via ajax", async () => {
    try {
      await page.evaluate(async () => {
        await window.saltcorn.mobileApp.navigation.handleRoute(
          "get/view/add_process_type"
        );
      });
      await page.waitForTimeout(1000);

      const rowsBefore = await page.request
        .get("http://localhost:3010/api/process_type")
        .then((res) => res.json());

      const iframe = page.frameLocator("iframe");
      const nameInput = iframe.locator("#inputname");
      await expect(nameInput).toBeVisible();
      await nameInput.fill("refret");
      await iframe.locator('button:has-text("SubmitWithAjax")').click();
      await page.waitForTimeout(1500);

      const rowsAfter = await page.request
        .get("http://localhost:3010/api/process_type")
        .then((res) => res.json());
      expect(rowsAfter.success.length).toBe(rowsBefore.success.length + 1);

      const inserted = rowsAfter.success.find(
        (r) => !rowsBefore.success.some((old) => old.id === r.id)
      );
      expect(inserted).toBeTruthy();
      expect(inserted.name).toBe("refret");

      // "Back to referer" should navigate to create_guitar (the referer left
      // by the previous test); it's a second round trip, so a generous timeout
      const newIframe = page.frameLocator("iframe");
      await expect(
        newIframe.locator('div[data-sc-embed-viewname="create_guitar"]')
      ).toHaveCount(1, { timeout: 10000 });
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });
});
