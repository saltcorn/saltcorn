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
        const current_file_name="People1.csv";
        const new_file_name="People2.csv";
        await functions.rename_file(current_file_name,new_file_name);

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
        const deletedFile = page.locator(pageobject.tablebodylocator+" td:nth-child(2)", { hasText: 'People2.csv' });
        await expect(deletedFile).toHaveCount(0);





    });

    test('Upload a jpg file', async () => {
        const filePath = 'Csv_file_to_uplaod/images.jpg';
        await functions.upload_file(filePath); 
        await page.waitForTimeout(2000);
        
    });
    test('Rename the jpg file', async () => {
        const current_file_name="images.jpg";
        const new_file_name="images2.jpg";
        await functions.rename_file(current_file_name,new_file_name);
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
        const deletedFile = page.locator(pageobject.tablebodylocator+" td:nth-child(2)", { hasText: 'images2.jpg' });
        await expect(deletedFile).toHaveCount(0);
    });

    test('Upload a pdf file', async () => {
        const filePath = 'Csv_file_to_uplaod/file_sample.pdf';
        await functions.upload_file(filePath); 
        await page.waitForTimeout(2000);
        
    });
    test('Rename the pdf file', async () => {
        const current_file_name="file_sample.pdf";
        const new_file_name="file_sample2.pdf";
        await functions.rename_file(current_file_name,new_file_name);
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
        const deletedFile = page.locator(pageobject.tablebodylocator+" td:nth-child(2)", { hasText: 'file_sample2.pdf' });
        await expect(deletedFile).toHaveCount(0);
    });



});
