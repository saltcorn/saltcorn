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

  test('Click table button and verify URL', async () => {
    //click table button
    await functions.click_table();
    // assert the table url
    expect(page.url()).toBe(baseURL + derivedURL + 'table');
  });
  
  // Assert the presence of "Your tables" tab
  test('Validate presence of "Your tables" tab', async () => {
    //click table button
    await functions.click_table();
    // assert the visiblity of table tab
    await expect(page.locator(pageobject.Yourtabletab)).toBeVisible();
  });

  // Assert the table contains "users" row by defalut
  test('Verify default "users" row in the table', async () => {
    //click table button
    await functions.click_table();
    //assert the default user table
    await expect(page.locator(pageobject.Defaultusertable)).toBeVisible();
  });

  // Assert the presence of "Create table" button
  test('Check visibility of "Create table" button', async () => {
    await expect(page.locator(pageobject.createtablebutton)).toBeVisible();
  });

  // Assert the presence of "Create from CSV upload" button
  test('Check visibility of "Create from CSV upload" button', async () => {
    //click table button
    await functions.click_table();
    //asert the create table from csv option
    await expect(page.locator(pageobject.createtablefromCSV)).toBeVisible();
  });

  // Assert the presence of "Discover tables" button
  test('Check visibility of "Discover tables" button', async () => {
    //click table button
    await functions.click_table();
    // assert the discover button
    await expect(page.locator(pageobject.discoverbutton)).toBeVisible();
  });

  // Assert the presence of "Relationship diagram" tab
  test('Validate presence of "Relationship diagram" tab', async () => {
    //click table button
    await functions.click_table();
    // assert the visibility of relationship diagram
    await expect(page.locator(pageobject.relationshipdiagram)).toBeVisible();
  });

  // Assert the presence of "Create new views" button
  test('Verify "Views" section and "Create new view" button', async () => {
    await page.waitForTimeout(2500);
    await functions.views();
    // assert the view edit url
    expect(page.url()).toBe(baseURL + derivedURL + 'viewedit');
    //assert the visibility of create new view
    await expect(page.locator(pageobject.createnewview)).toBeVisible();
    //click on create new view
    await page.click(pageobject.createnewview);
    expect(page.url()).toBe(baseURL + derivedURL + 'viewedit/new');
  });

  // Assert the presence of "About Application" button
  test('Validate "About Application" tabs', async () => {
    functions = new PageFunctions(page);
    // Navigate to setting
    await functions.navigate_To_Settings();
    // Navigate to about applications
    await functions.navigate_To_about_application();
    // validate each tab of about application
    await functions.Validate_each_tab_of_about_applications();
  });
  // Assert the presence of "Module" tab
  test('Validate "Module" tabs', async () => {
    functions = new PageFunctions(page);
    await page.waitForTimeout(2000);
    // Navigate to setting
    await functions.navigate_To_Settings();
    // Navigate to Module
    await functions.navigate_To_module();
    // validate each tab of module
    await functions.validate_Each_Tab_Of_Module();
  });

  // Assert the presence of "Users and Security" tab
  test('Validate "Users and Security" tabs', async () => {
    functions = new PageFunctions(page);
    // Navigate to setting
    await functions.navigate_To_Settings();
    // Navigate to Users and Security
    await functions.navigate_To_Users_And_Security();
    // validate each tab of users and security
    await functions.Validate_each_tab_of_Users_And_Security();
  });

  // Assert the presence of "Site Structure" tab
  test('Validate "Site Structure" tabs', async () => {
    functions = new PageFunctions(page);
    // Navigate to setting
    await functions.navigate_To_Settings();
    // Navigate to Site Structure
    await functions.navigate_To_Site_Structure();
    // validate each tab of  site structure
    await functions.Validate_each_tab_of_Site_Structure();
  });

  // Assert the presence of "Files" tab
  test('Validate "Files" tabs', async () => {
    functions = new PageFunctions(page);
    // Navigate to setting
    await functions.navigate_To_Settings();
    // Navigate to Files
    await functions.navigate_To_File();
    // validate each tab of  files
    await functions.Validate_each_tab_of_Files();
  });

  // Assert the presence of "Events" tab
  test('Validate "Events" tabs', async () => {
    functions = new PageFunctions(page);
    // Navigate to setting
    await functions.navigate_To_Settings();
    /// Navigate to Events
    await functions.navigate_To_Events();
    // validate each tab of events
    await functions.Validate_each_tab_of_Events();
  });
});