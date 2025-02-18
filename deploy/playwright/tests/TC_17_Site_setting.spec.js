const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');
const customAssert = require('../pageobject/utils.js');
const Logger = require('../pageobject/logger.js');

test.describe('E2E Test Suite', () => {
  let functions;
  let pageobject;
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    // Initialize the log file
    Logger.initialize();
    // Create a new context and page for all tests
    context = await browser.newContext({
      ignoreHTTPSErrors: true
    });

    page = await context.newPage();

    // Maximize the screen
    await page.setViewportSize({ width: 1350, height: 720 });

    functions = new PageFunctions(page);
    pageobject = new PageObject(page);

    // Navigate to base URL and perform login
    await functions.navigate_To_Base_URL(baseURL, derivedURL);
    await functions.login('myproject19july@mailinator.com', 'myproject19july');
    await functions.submit();
  });
  test.afterAll(async () => {
    // Close the page and context after all test
    await page.close();
    await context.close();
  });

  // create view with list view pattern
  test('validate site name', async () => {
    functions = new PageFunctions(page);
    // Navigate to setting
    await functions.navigate_To_Settings();
    // Navigate to about applications
    await page.click(pageobject.aboutApplicationLink);
    await customAssert('Assert the site name in Site identity tab is Saltcorn', async () => {
      await expect(page.locator(pageobject.inputsitename)).toHaveValue('Saltcorn');
    });
    await functions.fill_Text(pageobject.inputsitename, 'Saltcorn_new');
    await page.locator(pageobject.inputbase_url).click();
    await page.waitForTimeout(5000);
    await page.reload();
    await customAssert('Assert the site name in Site identity tab is Saltcorn', async () => {
      await expect(page.locator(pageobject.SaltCornButton)).toHaveText('Saltcorn_new');
    });
    await functions.clear_Data();
  });
});