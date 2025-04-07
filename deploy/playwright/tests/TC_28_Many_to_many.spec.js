const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');
const customAssert = require('../pageobject/utils.js');
const Logger = require('../pageobject/logger.js');
const fs = require('fs');

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

    // Add table by uplaoding csv
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
        await functions.fill_Text(pageobject.InputName, 'My_Table');
        // Click on create button
        await functions.submit();
        // Click on create view from table
        await page.waitForSelector(pageobject.Homecreateview);
        await page.click(pageobject.Homecreateview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'NewView_List');
        await page.fill(pageobject.discriptiontext, 'list view for table');
        // submit the page
        await functions.submit();
        // click on next button
        await page.waitForTimeout(2000);
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);
        // click on next button
        await functions.submit();
        await page.click(pageobject.finishbuttonprimary);
    });

    // Create Relation table
    test('Create relation table', async () => {
        // click table button
        await functions.click_table();
        // Click the "Create table" button
        await page.click(pageobject.createtablebutton);
        // Enter Table name
        await functions.fill_Text(pageobject.InputName, 'Relation');
        // click on Create button
        await page.click(pageobject.submitButton);
        // click on add field button
        await page.click(pageobject.addFieldButtonLocator);
        // Fill the lable name
        await functions.fill_Text(pageobject.labelTextboxlocator, 'Name');
        // select the input type
        const type = await page.$("#inputtype");
        await type?.selectOption("Key to My_Table");
        // Click on next button
        await functions.submit();
        // Select Full name on summary field
        await customAssert('Select Full name on summary field', async () => {
            await page.selectOption(pageobject.summaryFieldSelect, { label: 'Full name [String]' });
        });
        // Select Set null On delete of parant row
        await customAssert('Select Set cascade On delete of parant row ', async () => {
            await page.selectOption(pageobject.onDeleteSelect, { label: 'Cascade' });
        });
        // click on next button
        await functions.submit();
    });

    // Create many to many view
    test('Create many to many view', async () => {
        await functions.install_ManyToMany();
        await functions.views();
        await page.click(pageobject.createnewview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'Relation');
        await page.fill(pageobject.discriptiontext, 'Many to many relation for my table');
        await customAssert('View Pattern should be Many to many checkbox', async () => {
            // select the Edit pattern
            const viewPattern = await page.$("#inputviewtemplate");
            await viewPattern?.selectOption("Checkboxes many-to-many");
        });
        // validate the table name in table dropdown
        await customAssert('Select my_table to create many to many view', async () => {
            await page.locator('#inputtable_name').selectText('My_Table');
        });
        // submit the page
        await functions.submit();
        await page.waitForTimeout(1000);
        await customAssert('Select Relation.name→name→full_name in relation dropdown', async () => {
            await page.selectOption(pageobject.inputrelation, { label: 'Relation.name→name→full_name' });
        });
        // submit the page
        await functions.submit();
    });

    // Create show view and and add many to many relation on it
    test('Create show view and and add many to many relation on it', async () => {
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
        await customAssert('Select my_table to create show view', async () => {
            await page.locator('#inputtable_name').selectText('My_Table');
        });
        // submit the page
        await functions.submit();
        await page.waitForTimeout(2000);
        await page.click('text=Adam');
        // delete lable for full name
        await page.click(pageobject.deletebutton);
        // drag view element on target
        await functions.drag_And_Drop(pageobject.viewsource, pageobject.thirdrowcolumn2);
        await customAssert('Select NewView_List in view to show dropdown', async () => {
            await page.click(pageobject.View2Showdropdown);
            await page.click(pageobject.view2relation, { force: true });
        });
        await page.waitForTimeout(2000);
        // click on next button
        await page.click(pageobject.nextoption);
    });

    // add show link in list view
    test('Add show link in list view by by connecting show view', async () => {
        await functions.views();
        await page.click(pageobject.newviewlink);
        await page.waitForSelector(pageobject.editviewlink);
        await page.click(pageobject.editviewlink);
        // submit the page
        await functions.submit();
        // click on add column button on page
        await page.waitForSelector(pageobject.addcolumnbutton);
        await page.click(pageobject.addcolumnbutton);
        // drag and drop the viewlink locator
        await functions.drag_And_Drop(pageobject.viewlinksource, pageobject.newcolumn);
        // select view to show from dropdown
        await customAssert('Select show view in view to link dropdown', async () => {
            await page.click(pageobject.viewtolinkdropdown);
            // Click the view to edit option in the dropdown
            await page.click(pageobject.view2showoption);
        });
        // add lable for link
        await page.waitForSelector(pageobject.lebelforfield);
        await functions.fill_Text(pageobject.lebelforfield, 'Show');
        await page.waitForTimeout(2000);
        // click on next button
        await page.click(pageobject.nextoption);
        // click next button again
        await functions.submit();
        // click finish button
        await page.click(pageobject.finishbuttonprimary);
    });

    // test many to many checkbox in view
    test('test many to many checkbox in view', async () => {
        await functions.views();
        await page.click(pageobject.newviewlink);
        // Click on show link
        await page.click(pageobject.showfieldlink);
        // check the check boxes
        await customAssert('Assert that user is able to select the check boxes', async () => {
            await page.click(pageobject.checkboxAdam);
            await page.click(pageobject.donaldCheckbox);
        });
    })
});