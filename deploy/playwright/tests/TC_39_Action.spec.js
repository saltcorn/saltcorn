const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');
const customAssert = require('../pageobject/utils.js');
const Logger = require('../pageobject/logger.js');

test.describe('E2E Test Suite - Action confirmation and spinner on click', () => {
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

    test('Add delete action on People list and check confirmation popup', async () => {
        await functions.views();
        await page.click(pageobject.configurePeopleList);
        await page.waitForTimeout(2500);
        // Click on add column button
        await page.click(pageobject.addcolumnbutton);
        await customAssert('Drag and drop Aggregation field on page', async () => {
            await functions.drag_And_Drop(pageobject.ActionLocator, pageobject.newcolumn);
        });
        // After clicking add column, click the "User confirmation?" checkbox
        await page.click(pageobject.userconfirmationcheckbox);
        // Assert that the spinner on click checkbox is checked
        const spinnerCheckbox = page.locator(pageobject.spinneronclickcheckbox);
        await expect(spinnerCheckbox).toBeChecked();
        await page.waitForTimeout(5000);
        await page.click(pageobject.nextoption);
        await functions.views();
    });

    test('validate confirmation popup and spinner on click', async () => {
        await functions.views();
        await page.click(pageobject.PeopleList);
        let dialogMessage;
        page.once('dialog', async (dialog) => {
            dialogMessage = dialog.message();
            await dialog.dismiss();
        });
        await page.click(pageobject.deletebuttononclick);

        await customAssert('Confirmation popup should appear and user clicks Cancel', async () => {
            expect(dialogMessage).toBe('Are you sure?');
        });

        await customAssert('Spinner should be visible after cancel', async () => {
            const spinnerLocator = page.locator('.fa-spin, .spinner-border');
            await expect(spinnerLocator.first()).toBeVisible({ timeout: 3000 });
        });
    });
});
