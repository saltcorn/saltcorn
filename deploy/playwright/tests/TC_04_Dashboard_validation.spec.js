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
  });

  test.beforeEach(async ({ browser }) => {
    // Create a new context and page for each test
    context = await browser.newContext();
    page = await context.newPage();

    // Maximize the screen
    await page.setViewportSize({ width: 1350, height: 1080 });

    functions = new PageFunctions(page);
    pageobject = new PageObject(page);

    // Navigate to base URL and perform login
    await functions.navigate_To_Base_URL(baseURL, derivedURL);
    await functions.login('myproject19july@mailinator.com', 'myproject19july');
    await functions.submit();
  });

  test.afterEach(async () => {
    // Close the page and context after each test
    await page.close();
    await context.close();
  });

  // Assert the presence of "Tables" section
  test('Verify Saltcorn home page and check "Tables" section', async () => {
    // Saltcorn home page 
    await functions.SALTCORN();
    await customAssert('Assert Create Table button visible', async () => {
      await expect(page.locator(pageobject.createtablebutton)).toBeVisible();
      await expect(page.locator(pageobject.createtablebutton)).toHaveText('Create table');
    });
    await customAssert('Assert Csv upload button is visible', async () => {
      await expect(page.locator(pageobject.homeCSVuplaod)).toBeVisible();
      await expect(page.locator(pageobject.homeCSVuplaod)).toHaveText('CSV upload');
    });
  });

  // Assert the presence of "Create Table"
  test('Navigate to "Create table" page from Saltcorn home', async () => {
    await functions.SALTCORN();
    // click on create table button from dashboard
    await page.click(pageobject.createtablebutton);
    // assert the url for new table
    await customAssert('Assert url for page should be /table/new', async () => {
      expect(page.url()).toBe(baseURL + derivedURL + 'table/new');
    });
  });

  // Assert the presence of "Pages" section with "Create view" button
  test('Navigate to "Create view" page from Saltcorn home', async () => {
    await functions.SALTCORN();
    await customAssert('Assert Create view button is visible', async () => {
      await expect(page.locator(pageobject.Homecreateview)).toBeVisible();
      await expect(page.locator(pageobject.Homecreateview)).toHaveText('Create view');
      // click on create view button
      await page.click(pageobject.Homecreateview);
    });
    // Assert the url for create new view
    await customAssert('Assert url for create new view should be /viewedit/new', async () => {
      expect(page.url()).toBe(baseURL + derivedURL + 'viewedit/new');
    });
  });

  // Assert the presence of "Create page" button
  test('Navigate to "Create page" page from Saltcorn home', async () => {
    await functions.SALTCORN();
    await customAssert('Assert Create Page button is visible', async () => {
      await expect(page.locator(pageobject.Home_new_page_button)).toBeVisible();
      await expect(page.locator(pageobject.Home_new_page_button)).toHaveText('Create page');
      // click on create page button
      await page.click(pageobject.Home_new_page_button);
    });
    // Assert the url for new page
    await customAssert('Assert url for new page should be /pageedit/new', async () => {
      expect(page.url()).toBe(baseURL + derivedURL + 'pageedit/new');
    });
  });
});