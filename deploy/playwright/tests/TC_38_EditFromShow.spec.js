const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');
const customAssert = require('../pageobject/utils.js');
const Logger = require('../pageobject/logger.js');

test.describe('E2E Test Suite - Edit Field from Show View', () => {
    let functions;
    let pageobject;
    let context;
    let page;

    test.beforeAll(async ({ browser }) => {
        test.setTimeout(60000);
        // Initialize the log file
        Logger.initialize();
        // Create a new context and page for all tests
        context = await browser.newContext({
            ignoreHTTPSErrors: true
        });
        page = await context.newPage();

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

    test('Add table by uploading csv file', async () => {
        await functions.clear_Data();
        // click table button
        await functions.click_table();
        // Click on Create from CSV upload link
        await page.click(pageobject.createfromcsvupload);
        // Wait for the file input element to be available
        const fileInput = await page.waitForSelector('input[type="file"]');
        // Set the file input to the desired file
        const filePath = 'Csv_file_to_uplaod/People1.csv'; // Replace with the correct path to your CSV file
        await fileInput.setInputFiles(filePath);
        // fill table name on text box
        await functions.fill_Text(pageobject.InputName, 'People');
        // Click on create button
        await functions.submit();
    });

    test('Create view with show view pattern', async () => {
        await functions.views();
        // click on create new view
        await page.click(pageobject.createnewview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'Show_People');
        await page.fill(pageobject.discriptiontext, 'Show for people');
        // select show pattern
        await customAssert('Select show view pattern for view', async () => {
            const ShowPattern = await page.$("#inputviewtemplate");
            await ShowPattern?.selectOption("Show");
        });
        // submit the page
        await functions.submit();
        // select full name lable
        await page.waitForTimeout(4000);
        await page.click('div.d-inline:text("Adam")');

        // Click the checkbox: <input class="click-to-edit form-check-input" name="inline" type="checkbox">
        await customAssert('Click the inline edit checkbox', async () => {
            const checkbox = page.locator('input.click-to-edit.form-check-input[name="inline"][type="checkbox"]');
            await checkbox.click();
        });
        await page.waitForTimeout(5000);
        // click on next button
        await page.click(pageobject.nextoption);
    });

    test('Create List view from People table and add show link', async () => {
        await functions.views();
        // click on create new view
        await page.click(pageobject.createnewview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'People_list');
        await page.fill(pageobject.discriptiontext, 'view for People table');
        // submit the page
        await functions.submit();
        await page.waitForSelector(pageobject.addcolumnbutton);
        await page.click(pageobject.addcolumnbutton);
        // drag and drop the viewlink locator
        await functions.drag_And_Drop(pageobject.viewlinksource, pageobject.newcolumn);
        // select view to show from dropdown
        await customAssert('view to show dropdown should be visible', async () => {
            await page.waitForSelector(pageobject.viewtolinkdropdown);
            await expect(page.locator(pageobject.viewtolinkdropdown)).toBeVisible();
            await page.click(pageobject.viewtolinkdropdown);
            // Click the view to show option in the dropdown
            await page.click(`text=/Show_People.*\\[Show\\].*People/`);
        });

        // add lable for link
        await page.waitForSelector(pageobject.lebelforfield);
        await functions.fill_Text(pageobject.lebelforfield, 'Show');
        await page.waitForTimeout(5000);
        // click on next button
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);
        await functions.views();
    });

    test('Validate edit field on People show view', async () => {
        await functions.views();
        await page.click(pageobject.PeopleList);

        await customAssert('Assert show link is visible and working', async () => {
            await page.waitForSelector(pageobject.showfieldlink);
            // Click on show link
            await page.click(pageobject.showfieldlink);
        });

        await customAssert('Assert show view is open, full name is visible, and name Adam is editable and can be edited', async () => {

            // Assert that 'Adam' is present and visible in the show view
            const adamNameLocator = page.locator('span.current', { hasText: "Adam" });
            await adamNameLocator.waitFor({ state: 'visible', timeout: 5000 });
            await expect(adamNameLocator).toBeVisible();

            // Check if the name field is editable (click-to-edit or input appears)
            // Try to click to activate edit mode if not already an input
            const isInput = await adamNameLocator.evaluate(
                node => node.tagName === 'INPUT' || node.contentEditable === 'true'
            );
            if (!isInput) {
                await adamNameLocator.click();
            }
            // For example: input[name="full_name"], .editing input, etc.
            const nameInput = page.locator('input[type="text"], input.form-control, input[name="full_name"]');
            await nameInput.waitFor({ state: 'visible', timeout: 3000 });
            await expect(nameInput).toBeVisible();

            // Edit the name: clear and enter a new name, e.g., "Adam Edited"
            await nameInput.fill('Adam Edited');

            // Save the edit if required (maybe pressing Enter or clicking a save/checkmark button)
            // Below: try pressing Enter
            await nameInput.press('Enter');

            // Optionally, confirm the change by checking the text
            await expect(page.locator('span.current')).toHaveText('Adam Edited');
        });
    });
});
