const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');
const customAssert = require('../pageobject/utils.js');
const Logger = require('../pageobject/logger.js');
const fs = require('fs');
const { clear } = require('console');

test.describe('E2E Test Suite', () => {
    let functions;
    let pageobject;
    let context;
    let page;
    let YEAR;
    let MONTH;
    let DAY;

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

    // Check the "Create table" function
    test('Check the "Create table" Function', async () => {
        await functions.clear_Data();
        // click table button
        await functions.click_table();
        await customAssert('Create table button should be visible and working', async () => {
            await page.waitForSelector(pageobject.createtablebutton);
            await expect(page.locator(pageobject.createtablebutton)).toBeVisible();
            // Assert label of Create table button
            await expect(page.locator(pageobject.createtablebutton)).toHaveText('Create table');
            // Click the "Create table" button
            await page.click(pageobject.createtablebutton);
        });
        // Enter Table name
        await functions.fill_Text(pageobject.InputName, 'My_Table');
        await customAssert('Create button should be visible and working', async () => {
            await page.waitForSelector(pageobject.submitButton);
            await expect(page.locator(pageobject.submitButton)).toBeVisible();
            // Assert label of create button
            await expect(page.locator(pageobject.submitButton)).toHaveText('Create');
            // click on Create button
            await page.click(pageobject.submitButton);
        });
    });

    // Add Date of birth field in the table
    test('Add year of birth field in the table', async () => {
        // click table button
        await functions.click_table();
        // Go to my table
        await page.waitForSelector(pageobject.mytable);
        await page.click(pageobject.mytable);
        // click on add field button
        await page.waitForSelector(pageobject.addFieldButtonLocator);
        await page.click(pageobject.addFieldButtonLocator);
        // Fill the lable name
        await functions.fill_Text(pageobject.labelTextboxlocator, 'year of birth');
        // select the input type
        const type = await page.$("#inputtype");
        await type?.selectOption("Integer");
        // Fill the discription
        await functions.fill_Text(pageobject.descriptionSelector, 'year of birth of User');
        // Click on next button
        await functions.submit();
        // Fill the min length for field
        await functions.fill_Text(pageobject.minlocator, '1900');
        // Fill the max length for field
        await functions.fill_Text(pageobject.maxlocator, '2025');
        // Click on next button
        await functions.submit();
        // click on next button again
        await functions.submit();
    });

    // Add Age field in the table
    test('Add Age field in the table', async () => {
        // click table button
        await functions.click_table();
        // Go to my table
        await page.waitForSelector(pageobject.mytable);
        await page.click(pageobject.mytable);
        // click on add field button
        await page.waitForSelector(pageobject.addFieldButtonLocator);
        await page.click(pageobject.addFieldButtonLocator);
        // Fill the lable name
        await functions.fill_Text(pageobject.labelTextboxlocator, 'Age');
        await functions.fill_Text(pageobject.descriptionSelector, 'Age of User');

        // select the required check box
        await page.waitForSelector('#inputcalculated');
        await page.check('#inputcalculated');

        await functions.submit();

        // JavaScript / TypeScript
        const textarea = page.locator('#inputexpression');
        await textarea.fill('2025-year_of_birth');
        // click on finish button
        await functions.submit();
    });

    // create view with show view pattern
    test('Create view with show view pattern', async () => {
        await functions.views();
        // click on create new view
        await page.click(pageobject.createnewview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'showView');
        await page.fill(pageobject.discriptiontext, 'view for table');
        // select show pattern
        await customAssert('Select show view pattern for view', async () => {
            const ShowPattern = await page.$("#inputviewtemplate");
            await ShowPattern?.selectOption("Show");
        });
        // submit the page
        await functions.submit();

    });

    test('create new view with edit view pattern', async () => {
        await functions.views();
        // click on create new view
        await page.waitForSelector(pageobject.createnewview);
        await page.click(pageobject.createnewview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'View2_Edit');
        await page.fill(pageobject.discriptiontext, 'view for table');
        // validate the view pattern in table dropdown
        await customAssert('View Pattern should be Edit', async () => {
            // select the Edit pattern
            const EditPattern = await page.$("#inputviewtemplate");
            await EditPattern?.selectOption("Edit");
        });

        // submit the page
        await functions.submit();
        // drag and drop the page source on the page
        await page.waitForTimeout(500);
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);
        // click on finish button
        await functions.submit();
    });

    test('Validate calculated field', async () => {
    // Generate random year between 1900 and 2025
    const randomYear = Math.floor(Math.random() * (2025 - 1900 + 1)) + 1900;
    const expectedAge = 2025 - randomYear;

    await functions.views();

    // Click on show view 
    await page.waitForSelector(pageobject.view2editlink);
    await page.click(pageobject.view2editlink);

    // Enter the random year
    await page.waitForSelector(pageobject.yearOfBirthLocator);
    await page.click(pageobject.yearOfBirthLocator, { clickCount: 3 }); // select existing text
    await page.keyboard.press('Backspace');
    await page.keyboard.type(randomYear.toString());

    // Submit
    await page.waitForSelector(pageobject.submitButton);
    await page.click(pageobject.submitButton);
    await page.waitForTimeout(2000);

    // Assert that the displayed age matches calculation
    await expect(page.locator(pageobject.ageLocator).first())
        .toContainText(expectedAge.toString());
});
});
