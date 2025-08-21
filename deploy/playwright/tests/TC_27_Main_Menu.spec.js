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
    await page.setViewportSize({ width: 1500, height: 720 });

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

  // Create main menu on side panel
  test('Create page as main menu on side panel', async () => {
    await functions.SALTCORN();
    // Navigate to setting
    await functions.navigate_To_Settings();
    // Navigate to Site Structure
    await functions.navigate_To_Site_Structure();
    // Go to menu tab
    await functions.Site_Structure_to_Menu();
    // Select view option in type dropdown
    await page.selectOption(pageobject.inputtype, { value: 'Page' });
    // Select Landing page in page drop down
    await page.selectOption(pageobject.inputpagename, { value: 'Landing_Page' });
    // input text label for menu 
    await functions.fill_Text(pageobject.textInput, 'Subscription');
    // click on iconPickerButton to select icon for menu
    await page.click(pageobject.iconPickerButton);
    // Search icon for plan
    await page.click(pageobject.Searchiconbar);
    await page.keyboard.type('plan');
    // click on plan icon button
    await page.click(pageobject.planbutton);
    // Input tool tip for menu
    await functions.fill_Text(pageobject.tooltipInput, 'Click to see Subscription plans');
    // Select minimum role
    await page.selectOption(pageobject.minRoleDropdown, { label: 'user' });
    // Select maximum role
    await page.selectOption(pageobject.inputmax_role, { label: 'admin' });
    // Assert that 'disable on mobile' check box is not checked
    await customAssert('Assert that disable on mobile check box is not checked', async () => {
      await expect(page.locator(pageobject.disable_on_mobile)).not.toBeChecked();
    });
    // Assert that 'Open in new tab' check box is not checked
    await customAssert('Assert that Open in new tab check box is not checked', async () => {
      await expect(page.locator(pageobject.Open_newtab)).not.toBeChecked();
    });
    // Assert that 'Open in Pop up Model' check box is not checked
    await customAssert('Assert that Open in Pop up Model check box is not checked', async () => {
      await expect(page.locator(pageobject.Open_popup)).not.toBeChecked();
    });
    // Select style as link
    await page.selectOption(pageobject.styleDropdown, { label: 'Link' });
    // Select menu location
    await page.selectOption(pageobject.inputlocation, { label: 'Standard' });
    // Click on add button
    await page.click(pageobject.btnAdd);
    await page.waitForTimeout(500);

    // Reload the page
    await page.reload();
  });

  // Assert the Subscription menu
  test('Assert the Subscription menu', async () => {
    await functions.SALTCORN();
    await customAssert('Subscription menu should be present in side panal', async () => {
      await expect(page.locator(pageobject.SubscriptionMenu)).toBeVisible();
    });
    await page.click(pageobject.SubscriptionMenu);
    await customAssert('Assert the page url', async () => {
      await expect(page).toHaveURL(/.*Landing_Page/);
    });
  });

  // Create main menu on side panel
  test('Create Viewe as main menu on side panel', async () => {
    await functions.SALTCORN();
    // Navigate to setting
    await functions.navigate_To_Settings();
    // Navigate to Site Structure
    await functions.navigate_To_Site_Structure();
    // Go to menu tab
    await functions.Site_Structure_to_Menu();
    // Select view option in type dropdown
    await page.selectOption(pageobject.inputtype, { value: 'View' });
    // Select Landing page in page drop down
    await page.selectOption(pageobject.inputviewname, { value: 'Plan_List' });
    // input text label for menu 
    await functions.fill_Text(pageobject.textInput, 'Plan List');
    // click on iconPickerButton to select icon for menu
    await page.click(pageobject.iconPickerButton);
    // Search icon for plan
    await page.click(pageobject.Searchiconbar);
    await page.keyboard.type('plan');
    // click on plan icon button
    await page.click(pageobject.planbutton);
    // Input tool tip for menu
    await functions.fill_Text(pageobject.tooltipInput, 'Click to see Subscription plans List');
    // Select minimum role
    await page.selectOption(pageobject.minRoleDropdown, { label: 'user' });
    // Select maximum role
    await page.selectOption(pageobject.inputmax_role, { label: 'admin' });
    // Select style as link
    await page.selectOption(pageobject.styleDropdown, { label: 'Link' });
    // Select menu location
    await page.selectOption(pageobject.inputlocation, { label: 'Standard' });
    // Click on add button
    await page.click(pageobject.btnAdd);
    // Reload the page
    await page.reload();
  });

  // Assert the Subscription menu
  test('Assert the Plan list view as main menu', async () => {
    await functions.SALTCORN();
    await customAssert('Plan list menu should be present in side panal', async () => {
      await expect(page.locator(pageobject.PlanListMenu)).toBeVisible();
    });
    await page.click(pageobject.PlanListMenu);
    await customAssert('Assert the page url', async () => {
      await expect(page).toHaveURL(/.*Plan_List/);
    });
    await functions.clear_Data();
  });
});