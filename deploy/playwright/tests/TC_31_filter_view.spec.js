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

  test.beforeEach(async ({ browser }) => {
    functions = new PageFunctions(page);
  });

  test.afterAll(async () => {
    // Close the page and context after all test
    await page.close();
    await context.close();
  });

  test('Verify table creation', async () => {
    await functions.clear_Data();
    await functions.click_table();
    // Click on Create from CSV upload link
    await page.waitForSelector(pageobject.createfromcsvupload);
    await page.click(pageobject.createfromcsvupload);

    // Wait for the file input element to be available
    const fileInput = await page.waitForSelector('input[type="file"]');
    // Set the file input to the desired file
    const filePath = 'Csv_file_to_uplaod/People2.csv'; // Replace with the correct path to your CSV file
    await fileInput.setInputFiles(filePath);
    // fill table name on text box
    await functions.fill_Text(pageobject.InputName, 'My_Table');
    // Click on create button
    await functions.submit();
  });

  // Add status fieled in table
  test('Add status fieled in table', async () => {
    functions = new PageFunctions(page);
    // click table button
    await functions.click_table();
    // Go to my table
    await page.click(pageobject.mytable);
    // click on edit table button
    await page.click(pageobject.EditlinkLocator);
    // await page.waitForTimeout(1000);

    // Click on add row button
    await customAssert('status field on table should be visible ', async () => {
      await page.locator(pageobject.statustab, { hasText: 'Member' }).click();
    });
  });

  test('create view with list view pattern', async () => {
    functions = new PageFunctions(page);
    await functions.views();
    // click on create new view
    await page.click(pageobject.createnewview);
    // input view name and discription
    await page.fill(pageobject.InputName, 'NewView_List');
    await page.fill(pageobject.discriptiontext, 'view for table');

    // submit the page
    await functions.submit();
    // await page.waitForTimeout(1000);

    // click on next button
    await page.waitForSelector(pageobject.nextoption);
    await page.click(pageobject.nextoption);
    // click on next button
    await functions.submit();
    await functions.submit();
  });

  // create new view with Filter view pattern
  test('create new view with Filter view pattern', async () => {
    functions = new PageFunctions(page);
    await functions.views();
    // click on create new view
    await page.waitForSelector(pageobject.createnewview);
    await page.click(pageobject.createnewview);
    // input view name and discription
    await page.fill(pageobject.InputName, 'Filter');
    await page.fill(pageobject.discriptiontext, 'view for Filter');
    // validate the view pattern in table dropdown
    await customAssert('View Pattern should be Filter', async () => {
      // select the Edit pattern
      const EditPattern = await page.$("#inputviewtemplate");
      await EditPattern?.selectOption("Filter");
    });
    // submit the page
    await functions.submit();
    // await page.waitForTimeout(1000);
    // add new input box in page
    await functions.drag_And_Drop(pageobject.Dropdownfilter, pageobject.target);
    // click on field dropdown for field
    await customAssert('Select Status in field dropdown', async () => {
      await page.selectOption(pageobject.fielddropdown, { label: 'Status' });
    });
    await functions.drag_And_Drop(pageobject.viewsource, pageobject.target);
    await customAssert('Select NewView_List in view to show dropdown', async () => {
      await page.click(pageobject.View2Showdropdown);
      await page.click(pageobject.view2listMyTable, { force: true });
    });
    await functions.drag_And_Drop(pageobject.ActionLocator, pageobject.target);
    // click on next page
    await page.click(pageobject.nextoption);
  });
  test('select and clear filter', async () => {
    // Select the dropdown and choose the "Lapsed" option
    // await page.waitForTimeout(1000);
    await functions.views();
    await page.click(pageobject.Filterview);
    await page.selectOption(pageobject.filterStatus, 'Lapsed');
    await page.waitForTimeout(1000);

    // Assert that a table cell with 'Lapsed' is visible
    await expect(page.locator('td', { hasText: 'Lapsed' })).toBeVisible();

    // Assert that 'Member' is not visible in any <td>
    await expect(page.locator('td', { hasText: 'Member' })).not.toBeVisible();

    // Assert that 'Prospect' is not visible in any <td>
    await expect(page.locator('td', { hasText: 'Prospect' })).not.toBeVisible();

    await page.locator(pageobject.clearButton).click();
    // await page.waitForTimeout(1000);

    // Assert that the filter is cleared and all statuses are visible
    await expect(page.locator('td', { hasText: 'Lapsed' })).toBeVisible();

    // Assert that 'Member' is not visible in any <td>
    await expect(page.locator('td', { hasText: 'Member' })).toBeVisible();

  });

});
