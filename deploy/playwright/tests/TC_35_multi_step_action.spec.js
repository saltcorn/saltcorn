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

    test('create the table', async () => {
        await functions.clear_Data();
        await functions.click_table();
        // Click on Create from CSV upload link
        await page.waitForSelector(pageobject.createfromcsvupload);
        await page.click(pageobject.createfromcsvupload);

        // Wait for the file input element to be available
        const fileInput = await page.waitForSelector('input[type="file"]');
        // Set the file input to the desired file
        const filePath = 'Csv_file_to_uplaod/People2.csv';
        await fileInput.setInputFiles(filePath);
        // fill table name on text box
        await functions.fill_Text(pageobject.InputName, 'My_Table');
        // Click on create button
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
        // click on next button
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);
        // click on next button
        await functions.submit();
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
        await functions.submit();
        await page.locator(pageobject.Savebuttonlocator).click();
        // await page.locator('button:has-text("Save")').click()
        await page.locator(pageobject.actionDropdown, { hasText: 'Save' })
            .locator('.css-yk16xz-control')
            .click();

        // Type 'modify' into the input field
        await page.keyboard.type('Multi-Step Action');
        // await page.waitForTimeout(500);

        // Press Enter to select the option
        await page.keyboard.press('Enter');
        // await page.waitForTimeout(1000);

        const addButton = page.locator(pageobject.addmultistepbutton);
        await addButton.waitFor();
        for (let i = 0; i < 2; i++) {
            await addButton.click();
        }

        await page.locator(pageobject.stepOne).click();
        await page.locator(pageobject.multistepdropdown).click();
        // Type 'modify' into the input field
        await page.keyboard.type('form_action');
        // await page.waitForTimeout(500);
        // Press Enter to select the option
        await page.keyboard.press('Enter');
        // await page.waitForTimeout(1000);
        await page.locator(pageobject.FormActionButton).click();
        await page.keyboard.type('save');
        // await page.waitForTimeout(500);
        // Press Enter to select the option
        await page.keyboard.press('Enter');
        // await page.waitForTimeout(1000);


        await page.locator(pageobject.stepTwo).click();
        await page.locator(pageobject.multistepdropdown).click();
        await page.keyboard.type('reload_embedded_view');
        // await page.waitForTimeout(500);
        // Press Enter to select the option
        await page.keyboard.press('Enter');
        // await page.waitForTimeout(1000);
        await page.locator(pageobject.reloadDropdown).click();
        await page.keyboard.type('NewView_List');
        // await page.waitForTimeout(500);
        // Press Enter to select the option
        await page.keyboard.press('Enter');
        // await page.waitForTimeout(1000);

        await page.locator(pageobject.stepThree).click();
        await page.locator(pageobject.multistepdropdown).click();
        await page.keyboard.type('navigate');
        // await page.waitForTimeout(500);
        // Press Enter to select the option
        await page.keyboard.press('Enter');
        // await page.waitForTimeout(1000);
        await page.locator(pageobject.navActionlocator).click();
        await page.keyboard.type('Close modal');
        // await page.waitForTimeout(500);
        // Press Enter to select the option
        await page.keyboard.press('Enter');
        // await page.waitForTimeout(1000);

        // drag and drop the page source on the page
        // await page.waitForTimeout(1000);
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);
        // click on finish button
        await functions.submit();
    });

    // Add edit link in list view
    test('Add edit link in list view', async () => {
        // visit view 
        await functions.views();
        // click on newly created view link
        await page.waitForSelector(pageobject.newviewlink);
        await page.click(pageobject.newviewlink);
        // click on edit link
        await page.waitForSelector(pageobject.editviewlink);
        await page.click(pageobject.editviewlink);
        // submit the page
        await functions.submit();
        // click on add column button on page
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
        // add lable for link
        await functions.fill_Text(pageobject.lebelforfield, 'Edit');
        await page.waitForSelector(pageobject.viewtolinkdropdown);
        await page.click(pageobject.viewtolinkdropdown);

        await page.locator(pageobject.checkboxInput).nth(1).check();
        // click next button
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);
        // click next button again
        await functions.submit();
        // submit the page
        await functions.submit();
        // click finish button
        await functions.submit();
    });

    test('Assert the multiview control', async () => {
        await functions.views();
        // click to new view link again
        await page.waitForSelector(pageobject.newviewlink);
        await page.click(pageobject.newviewlink);
        // check visibility for edit butoon for row
        await customAssert('Edit field link should be visible', async () => {
            // click on edit button
            await page.waitForSelector(pageobject.editfieldlink);
            await page.click(pageobject.editfieldlink);
        });
    });
    test('Assert the multi step action', async () => {
        await functions.views();
        // click to new view link again
        await page.waitForSelector(pageobject.newviewlink);
        await page.click(pageobject.newviewlink);

        // Click the second "Edit" link
        await page.getByRole('link', { name: 'Edit' }).nth(1).click();
        await page.click(pageobject.AddressInput);
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.keyboard.type('Test address to validate multi step action');
        await page.locator(pageobject.multistepactionbutton).click();
        // Wait for first address cell to have the expected value
        await expect(
            page.locator(pageobject.tablelocator).first().locator('td').first()
        ).toHaveText('Test address to validate multi step action');

    });

});
