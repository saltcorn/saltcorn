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

    test('create the table', async () => {
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
        // await page.waitForTimeout(1000);
        await page.waitForSelector(pageobject.nextoption);

        await page.click(pageobject.nextoption);
        await page.locator('#inputauto_save').check();
        await page.locator('#inputenable_realtime').check();
        // click on finish button
        await functions.submit();
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
        await page.waitForSelector(pageobject.addcolumnbutton);
        await page.click(pageobject.addcolumnbutton);
        // drag and drop the action view link
        await page.waitForSelector(pageobject.viewlinksource);
        await functions.drag_And_Drop(pageobject.viewlinksource, pageobject.newcolumn);
        // click to view link dropdown
        await customAssert('view to link dropdown should be visible', async () => {
            await page.waitForSelector(pageobject.viewtolinkdropdown);
            await expect(page.locator(pageobject.viewtolinkdropdown)).toBeVisible();
            await page.click(pageobject.viewtolinkdropdown);
            // Click the view to edit option in the dropdown
            await page.click(pageobject.view2editoption);
        });
        // click on next button
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);
        // click on next button
        await functions.submit();
        await functions.submit();
        // await page.waitForTimeout(1000);
        console.log('code is working till test case number 3')
    });

    test('Real-time collaboration - New tab sees updated address after change', async () => {
        console.log('⏳ Starting real-time test with delayed tab');

        await functions.views();
        await page.click(pageobject.newviewlink);
        await Promise.all([
            page.waitForNavigation(), // Wait for the navigation to finish
            page.click(pageobject.editview2editlink),
        ]);

        // Now capture the URL after the click
        const editViewURL = page.url();
        // Page 1 modifies the value first
        await page.waitForSelector(pageobject.addresslocator);
        const newAddress = 'sumit';
        await page.click(pageobject.addresslocator);
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
        await page.keyboard.press('Backspace');
        await page.keyboard.type(newAddress);
        await page.click(pageobject.namelocator); // trigger blur/save

        console.log('✅ Address updated in page1');

        // Wait briefly to allow the system to auto-save/sync
        // await page.waitForTimeout(750);

        // Now open a new tab AFTER the change
        const page1 = await context.newPage();
        await page1.goto(editViewURL);
        await page1.waitForSelector(pageobject.addresslocator);

        // Check that page2 has the updated value
        const valueInPage1 = await page1.inputValue(pageobject.addresslocator);
        expect(valueInPage1).toBe(newAddress);
        console.log('✅ New tab sees updated address');
        await page1.close();
    });


});
