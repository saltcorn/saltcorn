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
  let randomString;

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

  test.beforeEach(async ({ browser }) => {
    // Assign a value to randomString here
    randomString = PageFunctions.generate_Random_String(10);
  });

  test.afterAll(async () => {
    // Close the page and context after all test
    await page.close();
    await context.close();
  });

  test('Create a new page ', async () => {
    await functions.clear_Data();
    // Create a new page 
    await functions.create_New_Page('toast_validation');
    // await page.waitForTimeout(2500);
    // Drag and drop the text source
    await page.waitForSelector(pageobject.ActionLocator);
    await functions.drag_And_Drop(pageobject.ActionLocator, pageobject.target);
    await page.locator(pageobject.actionDropdown).click();
    // await page.waitForTimeout(1000);

    // Type 'modify' into the input field
    await page.keyboard.type('Toast');
    // await page.waitForTimeout(500);

    // Press Enter to select the option
    await page.keyboard.press('Enter');
    // await page.waitForTimeout(1000);

    // Click and type into the "Text" field
    await page.click(pageobject.toastFieldName);
    await page.keyboard.type('Test_Toast_Message');

    // Click and type into the "Title" field
    await page.click(pageobject.toastTitle);
    await page.keyboard.type('Test_Toast_Title');

    await functions.Save_Page_Project();

    const url = baseURL + `/page/toast_validation`;
    // Navigate to the constructed URL in the same page
    await page.goto(url);

    await page.getByRole('button', { name: 'toast' }).click();

    await expect(page.locator(pageobject.toaster)).toContainText('Test_Toast_Message');
    await expect(page.locator(pageobject.toaster)).toContainText('Test_Toast_Title');

  });

});
