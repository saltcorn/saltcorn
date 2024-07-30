const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');

let storageState = 'storageState.json';

test.describe('E2E Test Suite', () => {
  let functions;
  let pageobject;
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    // Create a new context and page for all tests
    context = await browser.newContext();
    page = await context.newPage();
    
    functions = new PageFunctions(page);
    pageobject = new PageObject(page);
    
    // Navigate to base URL and perform login
    await functions.navigate_To_Base_URL(baseURL, derivedURL);
    await functions.login('myproject19july@mailinator.com', 'myproject19july');
    await functions.submit();
    
    // Save the logged-in state
    await context.storageState({ path: storageState });
  });

  test.beforeEach(async () => {
    // Reuse the existing context and page
    await functions.navigate_To_Base_URL(baseURL, derivedURL);
  });
// Assert the presence of "Tables" section
test('Verify Saltcorn home page and check "Tables" section', async () => {
    // Saltcorn home page 
    await functions.SALTCORN();
    await expect(page.locator(pageobject.createtablebutton)).toBeVisible();
    await expect(page.locator(pageobject.homeCSVuplaod)).toBeVisible();
  });

 // Assert the presence of "Create Table"
  test('Navigate to "Create table" page from Saltcorn home', async () => {
    await functions.SALTCORN();
    await page.click(pageobject.createtablebutton);
    expect(page.url()).toBe(baseURL + derivedURL + 'table/new');
  });

  // Assert the presence of "Pages" section with "Create view" button
  test('Navigate to "Create view" page from Saltcorn home', async () => {
    await functions.SALTCORN();
    await expect(page.locator(pageobject.Homecreateview)).toBeVisible();
    await page.click(pageobject.Homecreateview);
    expect(page.url()).toBe(baseURL + derivedURL + 'viewedit/new');
  });

  // Assert the presence of "Create page" button
  test('Navigate to "Create page" page from Saltcorn home', async () => {
    await functions.SALTCORN();
    await expect(page.locator(pageobject.Home_new_page_button)).toBeVisible();
    await page.click(pageobject.Home_new_page_button);
    expect(page.url()).toBe(baseURL + derivedURL + 'pageedit/new');
  });
});