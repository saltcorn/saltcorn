const { test, expect } = require("@playwright/test");

const { dumpHTML } = require("./helpers");

test.describe("Login Navigate Upload", () => {
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

  test("open login page", async () => {
    try {
      const iframe = page.frameLocator("iframe");
      await expect(iframe.locator('input[type="email"]')).toBeVisible();
      await expect(iframe.locator('input[type="password"]')).toBeVisible();
      await expect(iframe.locator('button[type="submit"]')).toBeVisible();
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("login with valid credentials", async () => {
    try {
      const iframe = page.frameLocator("iframe");
      await iframe.locator('input[type="email"]').fill("admin@foo.com");
      await iframe.locator('input[type="password"]').fill("AhGGr6rhu45");
      await iframe.locator('button[type="submit"]').click();
      await page.waitForTimeout(3000);
      const newIframe = page.frameLocator("iframe");
      const guitarFeedLink = newIframe.getByText("guitar feed", {
        exact: true,
      });
      await expect(guitarFeedLink).toBeVisible();

      const processListLink = newIframe.getByText("process list", {
        exact: true,
      });
      await expect(processListLink).toBeVisible();

      const toast = newIframe.locator(".toast .toast-body");
      await expect(toast).toHaveText(/Welcome, admin@foo.com!/i);
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("open network menu", async () => {
    try {
      const iframe = page.frameLocator("iframe");
      const networkLink = iframe.locator("a", { hasText: "Network" });
      await expect(networkLink).toBeVisible();
      await networkLink.click();
      await page.waitForTimeout(3000);
      const newIframe = page.frameLocator("iframe");

      await expect(
        newIframe.locator("div.fs-6.fw-bold.text-decoration-underline", {
          hasText: "Sync offline data",
        })
      ).toBeVisible();
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("toggle offline mode", async () => {
    try {
      const iframe = page.frameLocator("iframe");
      await iframe
        .locator(".form-check.form-switch input[type='checkbox']")
        .click();
      await page.waitForTimeout(3000);

      const newIframe = page.frameLocator("iframe");
      const alert = newIframe.locator(".alert.alert-info");
      await expect(alert).toBeVisible();
      await expect(alert).toHaveText(
        /You are offline, an internet connection is available./i
      );
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("create offline row", async () => {
    const iframe = page.frameLocator("iframe");

    // open dashboard
    await iframe.locator("a.navbar-brand").click();
    await page.waitForTimeout(3000);
    let newIframe = page.frameLocator("iframe");
    await expect(
      newIframe.getByText("guitar feed", {
        exact: true,
      })
    ).toBeVisible();
    await expect(
      newIframe.getByText("process list", {
        exact: true,
      })
    ).toBeVisible();
    const alert = newIframe.locator(".alert.alert-info");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(
      /You are offline, an internet connection is available./i
    );

    // open processed list
    await iframe.getByText("process list", { exact: true }).click();
    await page.waitForTimeout(3000);

    newIframe = page.frameLocator("iframe");
    await expect(
      newIframe.locator('div[data-sc-embed-viewname="list_processed"]')
    ).toHaveCount(1);
    await expect(
      newIframe.locator("a", { hasText: "Add processed" })
    ).toBeVisible();

    // click add processed
    await iframe.locator("a", { hasText: "Add processed" }).click();
    await page.waitForTimeout(3000);
    newIframe = page.frameLocator("iframe");

    // check calendar input exists
    const hiddenInput = newIframe.locator("input.flatpickr-input");
    await expect(hiddenInput).toBeHidden();

    // click to open calendar
    const visibleInput = iframe.locator('input[type="text"]');
    await visibleInput.click();
    const calendar = iframe.locator(".flatpickr-calendar");
    await expect(calendar).toBeVisible();

    // select a date and check the input
    const yearInput = iframe.locator(".numInput.cur-year");
    await yearInput.fill("2025");
    const monthSelect = iframe.locator("select.flatpickr-monthDropdown-months");
    await monthSelect.selectOption("7");
    const dayToSelect = iframe.locator(
      '.flatpickr-day[aria-label="August 25, 2026"]'
    );
    await dayToSelect.click();
    const dateInput = iframe.locator("input.flatpickr-input");
    const inputValue = await dateInput.inputValue();
    expect(inputValue).toBe("2026-08-25");

    // select a guitar
    const guitarInput = iframe.locator("select#inputguitar");
    await expect(guitarInput).toBeVisible();
    await guitarInput.selectOption("2");
    await expect(guitarInput).toHaveValue("2");

    // select a process type
    const processTypeInput = iframe.locator("select#inputtype");
    await expect(processTypeInput).toBeVisible();
    await processTypeInput.selectOption("1");
    await expect(processTypeInput).toHaveValue("1");

    // click submit
    await iframe.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    newIframe = page.frameLocator("iframe");
    await expect(
      newIframe.locator('div[data-sc-embed-viewname="list_processed"]')
    ).toHaveCount(1);
    await expect(
      newIframe.locator("a", { hasText: "Add processed" })
    ).toBeVisible();
  });

  test("check offline row in processed list", async () => {
    try {
      const iframe = page.frameLocator("iframe");
      const processedItem = iframe.locator(
        'div[data-sc-embed-viewname="list_processed"]'
      );
      const dateElement = processedItem.locator("time");
      await expect(dateElement).toHaveCount(6);
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("toggle online mode", async () => {
    try {
      const iframe = page.frameLocator("iframe");

      // open network menu
      const networkLink = iframe.locator("a", { hasText: "Network" });
      await expect(networkLink).toBeVisible();
      await networkLink.click();
      await page.waitForTimeout(3000);

      let newIframe = page.frameLocator("iframe");
      // click switcher
      await newIframe
        .locator(".form-check.form-switch input[type='checkbox']")
        .click();
      await page.waitForTimeout(3000);

      newIframe = page.frameLocator("iframe");
      const toast = newIframe.locator(".toast .toast-body");
      await expect(toast).toBeVisible();
      await expect(toast).toHaveText(/You are online again./i);
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("check online rows before sync", async () => {
    const iframe = page.frameLocator("iframe");

    // open dashboard
    await iframe.locator("a.navbar-brand").click();
    await page.waitForTimeout(3000);
    let newIframe = page.frameLocator("iframe");
    await expect(
      newIframe.getByText("guitar feed", {
        exact: true,
      })
    ).toBeVisible();

    // open processed list
    await iframe.getByText("process list", { exact: true }).click();
    await page.waitForTimeout(3000);

    newIframe = page.frameLocator("iframe");
    await expect(
      newIframe.locator('div[data-sc-embed-viewname="list_processed"]')
    ).toHaveCount(1);
    const processedItem = newIframe.locator(
      'div[data-sc-embed-viewname="list_processed"]'
    );
    const dateElement = processedItem.locator("time");
    await expect(dateElement).toHaveCount(5);
  });

  test("sync offline data", async () => {
    const iframe = page.frameLocator("iframe");

    // open network menu
    const networkLink = iframe.locator("a", { hasText: "Network" });
    await expect(networkLink).toBeVisible();
    await networkLink.click();
    await page.waitForTimeout(3000);

    let newIframe = page.frameLocator("iframe");
    // button with callSync() onclick
    const syncButton = newIframe.locator('button[onClick="callSync()"]');
    await expect(syncButton).toBeVisible();
    await syncButton.click();
    await page.waitForTimeout(3000);
    newIframe = page.frameLocator("iframe");
    const toast = newIframe.locator(".toast .toast-body");
    await expect(toast).toBeVisible();
    await expect(toast).toHaveText(/Synchronized your offline data./i);
  });

  test("check online rows after sync", async () => {
    const iframe = page.frameLocator("iframe");
    // open dashboard
    await iframe.locator("a.navbar-brand").click();
    await page.waitForTimeout(3000);
    let newIframe = page.frameLocator("iframe");
    await expect(
      newIframe.getByText("guitar feed", {
        exact: true,
      })
    ).toBeVisible();
    // open processed list
    await iframe.getByText("process list", { exact: true }).click();
    await page.waitForTimeout(3000);
    newIframe = page.frameLocator("iframe");
    await expect(
      newIframe.locator('div[data-sc-embed-viewname="list_processed"]')
    ).toHaveCount(1);
    const processedItem = newIframe.locator(
      'div[data-sc-embed-viewname="list_processed"]'
    );
    const dateElement = processedItem.locator("time");
    await expect(dateElement).toHaveCount(6);
  });
});
