const { test, expect } = require("@playwright/test");

const { dumpHTML } = require("./helpers");

test.describe("Offline Delete", () => {
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
      const iframe = page.frameLocator("#content-iframe");
      await expect(iframe.locator('input[type="email"]')).toBeVisible();
      await expect(iframe.locator('input[type="password"]')).toBeVisible();
      await expect(iframe.locator('button[type="submit"]')).toBeVisible();
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("login as user", async () => {
    try {
      const iframe = page.frameLocator("#content-iframe");
      await iframe.locator('input[type="email"]').fill("user@foo.com");
      await iframe.locator('input[type="password"]').fill("AhGGr6rhu45");
      await iframe.locator('button[type="submit"]').click();
      await page.waitForTimeout(1500);
      const newIframe = page.frameLocator("#content-iframe");
      const toast = newIframe.locator(".toast .toast-body");
      await expect(toast).toHaveText(/Welcome, user@foo.com!/i);
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("open network menu", async () => {
    try {
      const iframe = page.frameLocator("#content-iframe");
      const networkLink = iframe.locator("a", { hasText: "Network" });
      await expect(networkLink).toBeVisible();
      await networkLink.click();
      await page.waitForTimeout(1500);
      const newIframe = page.frameLocator("#content-iframe");

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
      const iframe = page.frameLocator("#content-iframe");
      await iframe
        .locator(".form-check.form-switch input[type='checkbox']")
        .click();
      await page.waitForTimeout(1500);

      const newIframe = page.frameLocator("#content-iframe");
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

  test("open dashboard and check guitar_list is visible", async () => {
    try {
      const iframe = page.frameLocator("#content-iframe");
      await iframe.locator("a.navbar-brand").click();
      await page.waitForTimeout(1500);
      const newIframe = page.frameLocator("#content-iframe");
      await expect(
        newIframe.getByText("guitar_list", {
          exact: true,
        })
      ).toBeVisible();
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("open guitar_list and check one row is visible", async () => {
    try {
      const iframe = page.frameLocator("#content-iframe");
      await iframe.getByText("guitar_list", { exact: true }).click();
      await page.waitForTimeout(1500);
      const newIframe = page.frameLocator("#content-iframe");
      await expect(newIframe.locator("table tbody tr")).toHaveCount(1);
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("delete the row and check table is empty", async () => {
    try {
      const iframe = page.frameLocator("#content-iframe");
      await iframe.getByText("Delete", { exact: true }).click();
      await page.waitForTimeout(1500);
      const newIframe = page.frameLocator("#content-iframe");
      await expect(newIframe.locator("table tbody tr")).toHaveCount(0);
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("toggle online mode", async () => {
    try {
      const iframe = page.frameLocator("#content-iframe");
      const networkLink = iframe.locator("a", { hasText: "Network" });
      await expect(networkLink).toBeVisible();
      await networkLink.click();
      await page.waitForTimeout(1500);

      const newIframe = page.frameLocator("#content-iframe");
      await newIframe
        .locator(".form-check.form-switch input[type='checkbox']")
        .click();
      await page.waitForTimeout(1500);

      const toast = page
        .frameLocator("#content-iframe")
        .locator(".toast .toast-body");
      await expect(toast).toBeVisible();
      await expect(toast).toHaveText(/You are online again./i);
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("sync offline data", async () => {
    try {
      const iframe = page.frameLocator("#content-iframe");
      const networkLink = iframe.locator("a", { hasText: "Network" });
      await expect(networkLink).toBeVisible();
      await networkLink.click();
      await page.waitForTimeout(1500);

      const newIframe = page.frameLocator("#content-iframe");
      const syncButton = newIframe.locator('button[onClick="callSync()"]');
      await expect(syncButton).toBeVisible();
      await syncButton.click();
      await page.waitForTimeout(1500);

      const toast = page
        .frameLocator("#content-iframe")
        .locator(".toast .toast-body");
      await expect(toast).toBeVisible();
      await expect(toast).toHaveText(/Synchronized your offline data./i);
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("check guitar_list is empty after sync", async () => {
    try {
      const iframe = page.frameLocator("#content-iframe");
      await iframe.locator("a.navbar-brand").click();
      await page.waitForTimeout(1500);

      const newIframe = page.frameLocator("#content-iframe");
      await expect(
        newIframe.getByText("guitar_list", { exact: true })
      ).toBeVisible();
      await page
        .frameLocator("#content-iframe")
        .getByText("guitar_list", { exact: true })
        .click();
      await page.waitForTimeout(1500);

      await expect(
        page.frameLocator("#content-iframe").locator("table tbody tr")
      ).toHaveCount(0);
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });
});
