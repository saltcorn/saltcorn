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

    test('Change language from English to Hindi', async () => {
        await functions.navigateToUserSettings();

        const languageSelect = page.locator('select[name="locale"]');

        // Assert default is English
        await expect(languageSelect).toHaveValue('en');

        // Change to Hindi
        await languageSelect.selectOption('hi');
        await page.waitForLoadState('networkidle');

        // Assert page text is Hindi
        await expect(page.locator('body')).toContainText('हिन्दी');

        // Assert toast appears with Hindi message
        const toast = page.locator('#toasts-area .toast');
        await expect(toast).toBeVisible();
        await expect(page.locator('#toasts-area .toast-body'))
            .toHaveText(/Language changed to हिन्दी/);

        // Assert dropdown value is now Hindi
        await expect(languageSelect).toHaveValue('hi');
    });

    test('Change language from Hindi to English', async () => {
        // await functions.navigateToUserSettings();

        const languageSelect = page.locator('select[name="locale"]');

        // Assert default is Hindi
        await expect(languageSelect).toHaveValue('hi');

        // Change to English
        await languageSelect.selectOption('en');
        await page.waitForLoadState('networkidle');

        // Assert toast appears with English message (in Hindi text form)
        const toast = page.locator('#toasts-area .toast');
        await expect(toast).toBeVisible();
        await expect(page.locator('#toasts-area .toast-body'))
            .toHaveText(/भाषा English में बदल दी गई है/);

        // Assert dropdown value is now English
        await expect(languageSelect).toHaveValue('en');
    });

});