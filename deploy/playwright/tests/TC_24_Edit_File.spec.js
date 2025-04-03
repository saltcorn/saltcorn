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

    test('Create file table', async () => {
        await functions.clear_Data();
        // click table button
        await functions.click_table();
        // Click the "Create table" button
        await page.click(pageobject.createtablebutton);
        // Enter Table name
        await functions.fill_Text(pageobject.InputName, 'File');
        // Click on next button
        await functions.submit();
        // click on add field button
        await page.waitForSelector(pageobject.addFieldButtonLocator);
        await page.click(pageobject.addFieldButtonLocator);
        // Fill the lable name
        await functions.fill_Text(pageobject.labelTextboxlocator, 'File');
        // select the input type
        const Ftype = await page.$("#inputtype");
        await Ftype?.selectOption("File");
        // Click on next button
        await functions.submit();
        // click on next button
        await functions.submit();
        // click on add field button
        await page.waitForSelector(pageobject.addFieldButtonLocator);
        await page.click(pageobject.addFieldButtonLocator);
        // Fill the lable name
        await functions.fill_Text(pageobject.labelTextboxlocator, 'Discription');
        // select the input type
        const type = await page.$("#inputtype");
        await type?.selectOption("String");
        // Click on next button
        await functions.submit();
        // click on next button
        await functions.submit();
    });

    test('Create view with list view pattern', async () => {
        await functions.views();
        await page.waitForSelector(pageobject.createnewview);
        await page.click(pageobject.createnewview);

        // input view name and discription
        await page.fill(pageobject.InputName, 'File_list');
        await page.fill(pageobject.discriptiontext, 'view for File');

        // select list pattern
        const ListPattern = await page.$("#inputviewtemplate");
        await ListPattern?.selectOption("List");
        await page.locator('#inputtable_name').selectText('File');
        // submit the page
        await functions.submit();
        await page.waitForTimeout(2000);
        await page.click(pageobject.file_link);
        await customAssert('field view dropdown should be visible', async () => {
            await page.waitForSelector(pageobject.fieldViewdropdown);
            await expect(page.locator(pageobject.fieldViewdropdown)).toBeVisible();
            // Select 'Thumbnail' from the dropdown
            await page.selectOption(pageobject.fieldViewdropdown, { label: 'Thumbnail' }); // If using a select dropdown
        });

        // click on add column button on page
        await page.waitForSelector(pageobject.addcolumnbutton);
        await page.click(pageobject.addcolumnbutton);
        // drag and drop the action locator
        await page.waitForSelector(pageobject.ActionLocator);
        await functions.drag_And_Drop(pageobject.ActionLocator, pageobject.newcolumn);
        // click on next button
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);
        // click on next button
        await functions.submit();
        await functions.submit();
    });

    test('create view with Edit view pattern', async () => {
        await functions.views();
        await page.waitForSelector(pageobject.createnewview);
        await page.click(pageobject.createnewview);

        // input view name and discription
        await page.fill(pageobject.InputName, 'Add_File');
        await page.fill(pageobject.discriptiontext, 'view for edit file');

        // select list pattern
        const ListPattern = await page.$("#inputviewtemplate");
        await ListPattern?.selectOption("Edit");
        await page.locator('#inputtable_name').selectText('File');
        // submit the page
        await functions.submit();
        await page.waitForTimeout(4000);
        await page.click(pageobject.choosefilebutton);
        await customAssert('field view dropdown should be visible', async () => {
            await page.waitForSelector(pageobject.fieldViewdropdown);
            await expect(page.locator(pageobject.fieldViewdropdown)).toBeVisible();
            // Select 'showDay' from the dropdown
            await page.selectOption(pageobject.fieldViewdropdown, { label: 'upload' }); // If using a select dropdown
        });
        // click on next button
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);
        await page.selectOption(pageobject.destinationview, { label: 'File_list [List on File]' }); // If using a select dropdown
        // click on next button
        await functions.submit();
        // await functions.submit();
        await page.waitForLoadState('networkidle');
    });

    test('Add File with Edit File view', async () => {
        await functions.views();
        await page.click(pageobject.FileEditlink);

        // Wait for the file input element to be available
        const fileInput = await page.waitForSelector('input[type="file"]');
        // Set the file input to the desired file
        const filePath = 'Csv_file_to_uplaod/file1.png'; // Replace with the correct path to your png file
        await fileInput.setInputFiles(filePath);
        // Click on create button
        await functions.submit();
        await expect(page.locator(pageobject.file1img)).toBeVisible();

        await functions.views();
        await page.click(pageobject.FileEditlink);
        await functions.fill_Text(pageobject.inputdisc, 'test discription');
        await functions.submit();
        await expect(page.locator(pageobject.file1img)).toBeVisible();
        await page.waitForTimeout(4000);
    });

    test('Create age table', async () => {
        // click table button
        await functions.click_table();
        // Click the "Create table" button
        await page.click(pageobject.createtablebutton);
        // Enter Table name
        await functions.fill_Text(pageobject.InputName, 'Age');
        // Click on next button
        await functions.submit();
        // click on add field button
        await page.waitForSelector(pageobject.addFieldButtonLocator);
        await page.click(pageobject.addFieldButtonLocator);
        // Fill the lable name
        await functions.fill_Text(pageobject.labelTextboxlocator, 'Age');
        // select the input type
        const type = await page.$("#inputtype");
        await type?.selectOption("Integer");
        // Click on next button
        await functions.submit();
        await functions.fill_Text(pageobject.minInputLocator, '0');
        await functions.fill_Text(pageobject.maxInputLocator, '100');
        // click on next button
        await functions.submit();
    });

    test('Show if Container in Edit File view', async () => {
        await functions.views();
        await page.waitForSelector(pageobject.createnewview);
        await page.click(pageobject.createnewview);

        // input view name and discription
        await page.fill(pageobject.InputName, 'Age_clc');
        await page.fill(pageobject.discriptiontext, 'view for age');

        // select list pattern
        const ListPattern = await page.$("#inputviewtemplate");
        await ListPattern?.selectOption("Edit");
        await page.locator('#inputtable_name').selectText('Age');
        // submit the page
        await functions.submit();
        await page.waitForTimeout(4000);

        await functions.drag_And_Drop(pageobject.containsdraglocator, pageobject.target);
        await page.click(pageobject.show_if_button);
        await functions.fill_Text(pageobject.formulatxtbox, 'age > 17');
        await page.click(pageobject.textSource);
        await functions.drag_And_Drop(pageobject.textSource, pageobject.containerfield);
        await functions.clearText(pageobject.richTextEditor);
        await page.keyboard.type('You are Eligible for voting');
        await page.click(pageobject.nextoption);
        // select the auto save to save any changes immediately
        await page.check(pageobject.AutoSaveCheckbox);
        // click on finish button
        await functions.submit();

        await functions.views();
        await page.click(pageobject.Ageclclink);
        await functions.fill_Text(pageobject.inputage, '45');
        await functions.submit();
        // await page.waitForSelector(pageobject.containText, { state: 'attached', timeout: 500 });
        await page.goBack();
        await expect(page.locator(pageobject.containText)).toBeVisible();
    });
}); 