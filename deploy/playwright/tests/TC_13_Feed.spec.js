const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');
const customAssert = require('../pageobject/utils.js');
const Logger = require('../pageobject/logger.js');
//const { assert } = require('console');

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

    // Create List view from People table
    test('Create List view from People table', async () => {
        await functions.views();
        // click on create new view
        await page.click(pageobject.createnewview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'People_list');
        await page.fill(pageobject.discriptiontext, 'view for People table');
        // submit the page
        await functions.submit();
        await customAssert('Set the position for columns', async () => {
            await functions.drag_And_Drop(pageobject.Column2FullName, pageobject.Column0Address);
            await functions.drag_And_Drop(pageobject.Column2DOB, pageobject.Column1Address);
        });
        await page.waitForTimeout(5000);
        // click on next button
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);
        await functions.views();
    });

    // Create Edit view from People table
    test('Create Edit view from People table', async () => {
        await functions.views();
        // click on create new view
        await page.click(pageobject.createnewview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'Edit_People');
        await page.fill(pageobject.discriptiontext, 'view to edit People');
        // select the Edit pattern
        await customAssert('Select edit view pattern for view', async () => {
            const EditPattern = await page.$("#inputviewtemplate");
            await EditPattern?.selectOption("Edit");
        });
        // submit the page
        await functions.submit();
        await customAssert('Set the position and properties for Name columns', async () => {
            await functions.drag_And_Drop(pageobject.namelabel, pageobject.addresslabel);
            await page.click(pageobject.AddressInput);
            await page.click(pageobject.fielddropdown);
            // Select 'full_name' from the dropdown
            await page.selectOption('select.form-control.form-select', 'full_name');
        });
        await customAssert('Set the position and properties for Address columns', async () => {
            await functions.drag_And_Drop(pageobject.addresslabel, pageobject.thirdrowcolumn1);
            await page.locator(pageobject.FullNameInput).nth(1).click();
            await page.click(pageobject.fielddropdown);
            // Select 'Date of birth' from the dropdown
            await page.selectOption('select.form-control.form-select', 'Address');
        });
        await page.waitForTimeout(5000);
        // click on next button
        await page.click(pageobject.nextoption);
        await functions.views();
    });

    // create view with show view pattern
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
        await page.click(pageobject.Fullnameshow);
        // delete lable for full name
        await page.click(pageobject.deletebutton);
        await customAssert('Drag Name on top of the page set heading', async () => {
            await functions.drag_And_Drop(pageobject.fieldsource, pageobject.addresslabel);
            await page.click(pageobject.fielddropdown);
            // Select 'full_name' from the dropdown
            await page.selectOption('select.form-control.form-select', 'full_name');

            // select text style as Heading 1 for full name
            await page.click("button.style-h1");
            await page.waitForTimeout(2000);
        });

        await customAssert('Drag address row on third column', async () => {
            await functions.drag_And_Drop(pageobject.AddressLocator, pageobject.thirdrowcolumn2);
        });
        await customAssert('Add edit link on page', async () => {
            await functions.drag_And_Drop(pageobject.viewlinksource, pageobject.thirdrowcolumn1);
            await functions.fill_Text(pageobject.lebelforfield, 'Edit');
        });
        // Action Style dropdown should be visible 
        await customAssert('Select Primary button in View link style dropdown', async () => {
            const styleDropdown = page.locator('.form-control.form-select').nth(0);
            // Open the dropdown and select the "Primary button" option
            await styleDropdown.selectOption({ label: 'Primary button' });
        });
        await customAssert('Add edit icon for edit button', async () => {
            await page.click(pageobject.angleDownIconLocator);
            await functions.fill_Text(pageobject.searchIconLocator, 'Edit');
            await page.click(pageobject.editIconLocator);
        });
        await functions.drag_And_Drop(pageobject.addresslabel, pageobject.thirdrowcolumn1);
        await page.click(pageobject.firstrowcolumn1);
        await functions.fill_Text(pageobject.NumberInput, '6');
        await page.waitForTimeout(5000);
        // click on next button
        await page.click(pageobject.nextoption);
    });

    // create view with Feed view pattern
    test('Create view with Feed view pattern', async () => {
        await functions.views();
        // click on create new view
        await page.click(pageobject.createnewview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'People_Feed');
        await page.fill(pageobject.discriptiontext, 'Feed for people');
        // select Feed pattern
        await customAssert('Select Feed view pattern for view', async () => {
            const FeedPattern = await page.$("#inputviewtemplate");
            await FeedPattern?.selectOption("Feed");
        });
        // submit the page
        await functions.submit();
        await customAssert('Select Show_people in show view dropdown', async () => {
            await page.selectOption(pageobject.ShowViewSelect, { label: 'Show_People [Show]' });
        });
        await customAssert('Select Edit_People in View to Create dropdown', async () => {
            await page.selectOption(pageobject.ViewToCreateSelect, { label: 'Edit_People [Edit]' });
        });
        // add lable for view to create
        await customAssert('Add lable to to create', async () => {
            await functions.fill_Text(pageobject.labeltocreate, 'New person');
        });
        await functions.submit();
        await customAssert('Select full name in Order field dropdown', async () => {
            await page.selectOption(pageobject.OrderFieldSelect, { label: 'full_name' });
        });
        await customAssert('Select Card in view decoration dropdown', async () => {
            await page.selectOption(pageobject.ViewDecorationSelect, { label: 'Card' });
        });
        await customAssert('Select number of Column for feed view', async () => {
            await functions.fill_Text(pageobject.ColsXlInput, '2');
        });
        await functions.submit();
    });

    // Add new record in people table and edit the record
    test('Add new record in people table and edit the record', async () => {
        await functions.views();
        await page.click(pageobject.Feedviewlink);
        await customAssert('Assert visibility of new person link and its working', async () => {
            await expect(page.locator(pageobject.NewPersonLink)).toBeVisible();
            await page.click(pageobject.NewPersonLink);
        });
        await customAssert('Fill data in fields to add record in table', async () => {
            await functions.fill_Text(pageobject.InputFullName, 'Edward');
            await functions.fill_Text(pageobject.inputDateOfBirth, '1998-09-08');
            await functions.fill_Text(pageobject.AddressInput, 'HN 01, WN 26 noida india ');
            await page.click(pageobject.saveactionbutton);
        });

        await functions.views();
        await page.click(pageobject.Feedviewlink);
        await customAssert('Newly added record should be present', async () => {
            await expect(page.getByText('Edward').first()).toBeVisible();
        });
        await customAssert('Edit Newly added record in table', async () => {
            await page.click(pageobject.EditButton2);
            await functions.fill_Text(pageobject.AddressInput, 'HN 02, WN 27 Noida India ');
            await page.click(pageobject.saveactionbutton);
        });
    });
});
