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

  test("open guitar feed and go back to dashboard", async () => {
    try {
      const iframe = page.frameLocator("iframe");
      await iframe.getByText("guitar feed", { exact: true }).click();
      await page.waitForTimeout(3000);

      const newIframe = page.frameLocator("iframe");
      await expect(
        newIframe.locator(
          '.card-body div[data-sc-embed-viewname="show_guitar"]'
        )
      ).toHaveCount(5);
      await expect(
        newIframe.locator('button:has-text("Add guitar")')
      ).toBeVisible();

      // click navbar brand and check dashboard is visible
      await newIframe.locator("a.navbar-brand").click();
      await page.waitForTimeout(3000);
      const dashboardIframe = page.frameLocator("iframe");
      await expect(
        dashboardIframe.getByText("guitar feed", {
          exact: true,
        })
      ).toBeVisible();

      await expect(
        dashboardIframe.getByText("process list", {
          exact: true,
        })
      ).toBeVisible();
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("open process list and click add processed", async () => {
    try {
      const iframe = page.frameLocator("iframe");
      await iframe.getByText("process list", { exact: true }).click();
      await page.waitForTimeout(3000);

      // check list is open
      let newIframe = page.frameLocator("iframe");
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
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("fill out inputs", async () => {
    try {
      const iframe = page.frameLocator("iframe");
      const visibleInput = iframe.locator('input[type="text"]');
      await visibleInput.click();
      const calendar = iframe.locator(".flatpickr-calendar");
      await expect(calendar).toBeVisible();

      // select a date and check the input
      const yearInput = iframe.locator(".numInput.cur-year");
      await yearInput.fill("2025");
      await yearInput.press("Enter");

      const monthSelect = iframe.locator(
        "select.flatpickr-monthDropdown-months"
      );
      await monthSelect.selectOption("7");
      const dayToSelect = iframe.locator(
        '.flatpickr-day[aria-label="August 25, 2025"]'
      );
      await dayToSelect.click();
      const dateInput = iframe.locator("input.flatpickr-input");
      const inputValue = await dateInput.inputValue();
      expect(inputValue).toBe("2025-08-25");

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
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("submit a processed item", async () => {
    try {
      const iframe = page.frameLocator("iframe");
      await iframe.locator('button[type="submit"]').click();
      await page.waitForTimeout(3000);

      let newIframe = page.frameLocator("iframe");
      await expect(
        newIframe.locator('div[data-sc-embed-viewname="list_processed"]')
      ).toHaveCount(1);

      const processedItem = newIframe.locator(
        'div[data-sc-embed-viewname="list_processed"]'
      );
      const dateElement = processedItem.locator("time");
      await expect(dateElement).toHaveCount(5);

      const timeElement = newIframe.locator(
        'time[datetime="2025-08-25T00:00:00.000Z"]'
      );
      await expect(timeElement).toHaveCount(3);
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });
});
