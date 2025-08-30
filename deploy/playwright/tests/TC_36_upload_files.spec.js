const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');
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

    // Test to validate the "Files" tab and its elements
    test('Upload a csv file', async () => {

        await functions.clear_Data();
        await functions.SALTCORN();
        await functions.navigate_To_Settings();
        await functions.navigate_To_File();
        await page.waitForTimeout(2000);
        const filePath = 'Csv_file_to_uplaod/People1.csv';
        await functions.upload_file(filePath);
        await page.waitForTimeout(2000);


    });

    test('Rename the csv file', async () => {
        const current_file_name = "People1.csv";
        const new_file_name = "People2.csv";
        await functions.rename_file(current_file_name, new_file_name);

    });

    test('Delete the csv file', async () => {
        await page.waitForSelector(pageobject.tablebodylocator);
        await page.locator(pageobject.tablebodylocator).nth(0).click();
        //a dialog handler BEFORE the action that triggers it
        await page.once('dialog', async dialog => {
            console.log(dialog.message());
            await dialog.accept();
        });
        // Wait for the Action dropdown to be visible
        await page.locator(pageobject.actionselector).nth(2).waitFor({ state: "visible" });
        await page.locator(pageobject.actionselector).nth(2).click();
        await page.keyboard.type('Delete');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        const deletedFile = page.locator(pageobject.tablebodylocator + " td:nth-child(2)", { hasText: 'People2.csv' });
        await expect(deletedFile).toHaveCount(0);

    });

    test('Upload a jpg file', async () => {
        const filePath = 'Csv_file_to_uplaod/images.jpg';
        await functions.upload_file(filePath);
        await page.waitForTimeout(2000);

    });

    test('Rename the jpg file', async () => {
        const current_file_name = "images.jpg";
        const new_file_name = "images2.jpg";
        await functions.rename_file(current_file_name, new_file_name);
    });

    test('Delete the jpg file', async () => {
        await page.waitForSelector(pageobject.tablebodylocator);
        await page.locator(pageobject.tablebodylocator).nth(0).click();
        //a dialog handler BEFORE the action that triggers it
        await page.once('dialog', async dialog => {
            console.log(dialog.message());
            await dialog.accept();
        });
        // Wait for the Action dropdown to be visible
        await page.locator(pageobject.actionselector).nth(2).waitFor({ state: "visible" });
        await page.locator(pageobject.actionselector).nth(2).click();
        await page.keyboard.type('Delete');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        const deletedFile = page.locator(pageobject.tablebodylocator + " td:nth-child(2)", { hasText: 'images2.jpg' });
        await expect(deletedFile).toHaveCount(0);
    });

    test('Upload a pdf file', async () => {
        const filePath = 'Csv_file_to_uplaod/file_sample.pdf';
        await functions.upload_file(filePath);
        await page.waitForTimeout(2000);

    });

    test('Rename the pdf file', async () => {
        const current_file_name = "file_sample.pdf";
        const new_file_name = "file_sample2.pdf";
        await functions.rename_file(current_file_name, new_file_name);
    });

    test('Delete the pdf file', async () => {
        await page.waitForSelector(pageobject.tablebodylocator);
        await page.locator(pageobject.tablebodylocator).nth(0).click();
        //a dialog handler BEFORE the action that triggers it
        await page.once('dialog', async dialog => {
            console.log(dialog.message());
            await dialog.accept();
        });
        // Wait for the Action dropdown to be visible
        await page.locator(pageobject.actionselector).nth(2).waitFor({ state: "visible" });
        await page.locator(pageobject.actionselector).nth(2).click();
        await page.keyboard.type('Delete');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        const deletedFile = page.locator(pageobject.tablebodylocator + " td:nth-child(2)", { hasText: 'file_sample2.pdf' });
        await expect(deletedFile).toHaveCount(0);
    });

    test('Change access of the file to public', async () => {
        const filePath = 'Csv_file_to_uplaod/file_sample.pdf';
        await functions.upload_file(filePath);
        await page.waitForTimeout(2000);
        await page.locator(pageobject.tablebodylocator).nth(0).click();
        await page.locator(pageobject.actionselector).nth(0).waitFor({ state: "visible" });
        await page.locator(pageobject.actionselector).nth(0).click();
        await page.keyboard.type('public');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        const firstRow = page.locator(pageobject.tablelocator).nth(0);
        const mediaType = firstRow.locator("td").nth(2); // Media type column
        const roleToAccess = firstRow.locator("td").nth(4); // Role to access column
        await expect(mediaType).toHaveText("application/pdf");  
        await expect(roleToAccess).toHaveText("public");
    });

    test('Change access of the file to staff', async () => {
        const filePath = 'Csv_file_to_uplaod/file_sample.pdf';
        await functions.upload_file(filePath);
        await page.waitForTimeout(2000);
        await page.locator(pageobject.tablebodylocator).nth(0).click();
        await page.locator(pageobject.actionselector).nth(0).waitFor({ state: "visible" });
        await page.locator(pageobject.actionselector).nth(0).click();
        await page.keyboard.type('staff');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        const firstRow = page.locator(pageobject.tablelocator).nth(0);
        const mediaType = firstRow.locator("td").nth(2); // Media type column
        const roleToAccess = firstRow.locator("td").nth(4); // Role to access column
        await expect(mediaType).toHaveText("application/pdf"); 
        await expect(roleToAccess).toHaveText("staff");
    });

    test('Change access of the file to user', async () => {
        const filePath = 'Csv_file_to_uplaod/file_sample.pdf';
        await functions.upload_file(filePath);
        await page.waitForTimeout(2000);
        await page.locator(pageobject.tablebodylocator).nth(0).click();
        await page.locator(pageobject.actionselector).nth(0).waitFor({ state: "visible" });
        await page.locator(pageobject.actionselector).nth(0).click();
        await page.keyboard.type('user');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        const firstRow = page.locator(pageobject.tablelocator).nth(0);
        const mediaType = firstRow.locator("td").nth(2); // Media type column
        const roleToAccess = firstRow.locator("td").nth(4); // Role to access column
        await expect(mediaType).toHaveText("application/pdf"); 
        await expect(roleToAccess).toHaveText("user");
    });

    test('Change access of the file to admin', async () => {
        const filePath = 'Csv_file_to_uplaod/file_sample.pdf';
        await functions.upload_file(filePath);
        await page.waitForTimeout(2000);
        await page.locator(pageobject.tablebodylocator).nth(0).click();
        await page.locator(pageobject.actionselector).nth(0).waitFor({ state: "visible" });
        await page.locator(pageobject.actionselector).nth(0).click();
        await page.keyboard.type('admin');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        const firstRow = page.locator(pageobject.tablelocator).nth(0);
        const mediaType = firstRow.locator("td").nth(2); // Media type column
        const roleToAccess = firstRow.locator("td").nth(4); // Role to access column
        await expect(mediaType).toHaveText("application/pdf");  
        await expect(roleToAccess).toHaveText("admin");
    });

      test('Create new folder', async () => {
        await functions.dialog_handle("folder1");
        const createNewFolderRow = page.locator(pageobject.tablelocator, { hasText: "Create new folder..." });
        await createNewFolderRow.click();
        await page.waitForTimeout(2000);
        await expect(page.locator('tbody td').filter({ hasText: 'folder1/' })).toBeVisible();
        const firstRow = page.locator(pageobject.tablelocator).nth(0);
        const roleToAccess = firstRow.locator("td").nth(4); 
        await expect(roleToAccess).toHaveText("admin");
    });

    test('download archived files', async () => {
        await functions.clear_Data();
        await functions.SALTCORN();
        await functions.navigate_To_Settings();
        await functions.navigate_To_File();
        await page.waitForTimeout(2000);
        await functions.upload_file('Csv_file_to_uplaod/file_sample.pdf');
        await functions.upload_file('Csv_file_to_uplaod/basic.png');
        await functions.upload_file('Csv_file_to_uplaod/images.jpg');
        await page.locator(pageobject.tablebodylocator).nth(1).click();
        await page.keyboard.down('Control');
        await page.keyboard.type('a');
        await page.keyboard.up('Control');

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.getByRole('button', { name: 'Download Zip Archive' }).click()
        ]);

        const path = await download.path();
        expect(path).not.toBeNull();  

        const filename = download.suggestedFilename();
        expect(filename).toMatch(/\.zip$/);

    });


});
