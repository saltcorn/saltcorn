const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');
const customAssert = require('../pageobject/utils.js');
const Logger = require('../pageobject/logger.js');

test.describe('E2E Test Suite - Tablet View', () => {
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

    test('Create a new page with tablet view name', async () => {
        await functions.clear_Data();
        await page.goto(baseURL + derivedURL + 'pageedit');
        await functions.create_New_Page('Tablet_view');
        await page.waitForTimeout(3500);
        await page.waitForSelector(pageobject.textSource, { timeout: 15000 });

        const fillTextElement = async (text) => {
            await page.waitForSelector(pageobject.textlocator, { state: 'visible', timeout: 5000 });
            await functions.fill_Text(pageobject.textlocator, '');
            await page.waitForTimeout(500);
            await functions.fill_Text(pageobject.textlocator, text);
        };

        await functions.drag_And_Drop(pageobject.textSource, pageobject.target);
        await fillTextElement('Welcome to Tablet View - Responsive Preview');

        await functions.drag_And_Drop(pageobject.textSource, pageobject.target);
        await fillTextElement('This page demonstrates how content reflows when switching between desktop, tablet and mobile views. Watch the columns stack vertically on smaller screens.');

        await functions.drag_And_Drop(pageobject.columnsElement, pageobject.target);
        await page.waitForSelector(pageobject.builderColSm6First, { state: 'visible', timeout: 5000 });
        await functions.drag_And_Drop(pageobject.textSource, pageobject.builderColSm6First);
        await fillTextElement('Left column: Features and benefits displayed here. On mobile this stacks above the right column.');
        await functions.drag_And_Drop(pageobject.textSource, pageobject.builderColSm6Second);
        await fillTextElement('Right column: Additional content goes here. Tablet view shows side by side, mobile shows stacked.');

        await functions.drag_And_Drop(pageobject.columnsElement, pageobject.target);
        await page.waitForTimeout(500);
        const secondBlockCol1 = page.locator('div.canvas.root-canvas .split-col.col-sm-6 .canvas').nth(2);
        const secondBlockCol2 = page.locator('div.canvas.root-canvas .split-col.col-sm-6 .canvas').nth(3);
        await secondBlockCol1.waitFor({ state: 'visible', timeout: 5000 });
        await page.locator(pageobject.textSource).dragTo(secondBlockCol1, { force: true });
        await fillTextElement('Section 2 - Column A: More content to see layout changes.');
        await page.locator(pageobject.textSource).dragTo(secondBlockCol2, { force: true });
        await fillTextElement('Section 2 - Column B: Compare desktop vs tablet vs mobile layouts.');

        await functions.drag_And_Drop(pageobject.textSource, pageobject.target);
        await fillTextElement('Footer text: Switch between device icons above to preview responsive behavior.');

        await functions.drag_And_Drop(pageobject.linkSource, pageobject.target);
        await functions.fill_Text(pageobject.linklocator, 'Visit Saltcorn');
        await functions.fill_Text(pageobject.linkurllocator, 'https://saltcorn.com');

        const tabletBtn = page.getByTitle('Tablet').or(page.locator(pageobject.devicePreviewTabletBtn));
        const mobileBtn = page.getByTitle('Mobile').or(page.locator(pageobject.devicePreviewMobileBtn));
        const desktopBtn = page.getByTitle('Desktop').or(page.locator(pageobject.devicePreviewDesktopBtn));
        if (await tabletBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await tabletBtn.click();
            await page.waitForTimeout(500);
            await customAssert('Tablet view should be active', async () => {
                await expect(tabletBtn).toHaveClass(/btn-primary/);
            });
            await mobileBtn.click();
            await page.waitForTimeout(500);
            await customAssert('Mobile view should be active', async () => {
                await expect(mobileBtn).toHaveClass(/btn-primary/);
            });
            await desktopBtn.click();
            await page.waitForTimeout(500);
        }

        await customAssert('Page builder should have content and canvas visible', async () => {
            expect(page.url()).toContain('pageedit');
            await expect(page.locator(pageobject.target)).toBeVisible();
        });

        await page.click(pageobject.newPage_sidebar);
        // Click on Tablet_view page in the sidebar
        await page.click('a:has-text("Tablet_view")');

        // Switch to tablet resolution and check the page is visible
        await page.setViewportSize({ width: 800, height: 1000 });
        // Assert that the "Visit Saltcorn" link is visible on the rendered page at tablet resolution
        await expect(page.locator('a[href="https://saltcorn.com"]')).toBeVisible();

        // Switch to mobile resolution and check the page is visible
        await page.setViewportSize({ width: 430, height: 900 });
        await expect(page.locator('a[href="https://saltcorn.com"]')).toBeVisible();
    });
});
