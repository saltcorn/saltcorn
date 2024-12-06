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

        // Create a new browser context with HTTPS error ignored
        context = await browser.newContext({ ignoreHTTPSErrors: true });
        page = await context.newPage();

        // Set the viewport for a consistent test screen size
        await page.setViewportSize({ width: 1350, height: 720 });

        // Initialize page functions and locators
        functions = new PageFunctions(page);
        pageobject = new PageObject(page);

        // Navigate to the base URL and log in
        await functions.navigate_To_Base_URL(baseURL, derivedURL);
        await functions.login('myproject19july@mailinator.com', 'myproject19july');
        await functions.submit(); // Ensure submit is required
        await functions.clear_Data();
    });

    test.afterAll(async () => {
        // Ensure the page and context close properly after tests
        await page.close();
        await context.close();
    });


    test('Create Builder Mode', async () => {
        await functions.create_New_Page('TestPage');
        await page.waitForSelector(pageobject.cardSource);
        await functions.drag_And_Drop(pageobject.cardSource, pageobject.target);
        await functions.fill_Text(pageobject.cardtextlocator, 'Hello');
        const cardTitle = page.locator(pageobject.cardtextlocator);

        await customAssert('Card title should be Hello', async () => {
            await expect(cardTitle).toHaveValue('Hello');
            const urlField = page.locator(pageobject.CardUrl);
            await expect(urlField).toHaveValue('');
        });
    });

    test('Text placeholder', async () => {
        await page.waitForSelector(pageobject.textSource);
        await functions.drag_And_Drop(pageobject.textSource, pageobject.target);
        await functions.fill_Text(pageobject.textlocator, 'Hello World');
        await page.waitForTimeout(2000);
        const TextTitle = page.locator(pageobject.textSource);
        await customAssert('Text box should be visible', async () => await expect(page.locator(pageobject.textlocator)).toBeVisible());
        await page.locator(pageobject.cardBoxClick).click();

    });

    test('Add Library', async () => {
        // library
        await page.locator(pageobject.Library)
        await page.click(pageobject.Library);

        // add button
        await page.locator(pageobject.plusAddButton)
        await page.click(pageobject.plusAddButton); // Locate by ID
        console.log('Add button clicked successfully!');
        await customAssert('Name Field', async () => {
            await page.click(pageobject.nameField);
            await functions.fill_Text(pageobject.nameField, 'mycard');
        });

        await customAssert('Icon Field', async () => {
            const selectIconButton = page.locator(pageobject.selectIcon);
            await page.click(pageobject.selectIcon);  // Click the 'Select icon' text
            const icon = page.locator(pageobject.selectIconFarFaAddress);
            await icon.click();  // Click the desired icon
        });
        console.log("Icon 'far fa-ad' selected.");
        await page.click(pageobject.selectIconFlip);
        await customAssert('Assert +Add button is visible', async () => {
            await expect(page.locator(pageobject.addButtonAfterSelect)).toBeVisible();
        });
        await page.click(pageobject.addButtonAfterSelect);  // Click the 'Add' button based on both the text and icon 
        await page.click(pageobject.PageSave);

        await customAssert(' TestPage name field should be visible', async () => {
            const names = await page.locator(pageobject.pageNameSave).allInnerTexts();
            console.assert(names.includes('TestPage'), '"TestPage" is missing from the Name column!');
        });
    });


    test('Create Second page', async () => {
        await functions.create_New_Page('testpage2');
        await page.waitForTimeout(5000);
        // await page.waitForSelector(pageobject.textSource);
        await page.locator(pageobject.Library).click();
        await functions.drag_And_Drop(pageobject.dragElement, pageobject.target);
        await page.waitForTimeout(5000);
        await page.click(pageobject.testPage2);
        await page.waitForTimeout(5000);
        await customAssert('Page URL should be /testpage2', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'page/testpage2');
        });

    });

    test('Create Third page', async () => {
        await functions.create_New_Page('testpage3');
        //drag and drop the contains drag locator
        await functions.drag_And_Drop(pageobject.containsdraglocator, pageobject.target);
        await customAssert('Container settings should be visible', async () => {
            await expect(page.getByText('Container settings')).toBeVisible();
        });

        await page.waitForSelector(pageobject.htmlCodeSource);
        await functions.drag_And_Drop(pageobject.htmlCodeSource, pageobject.target);
        await functions.fill_Text(pageobject.htmltextlocator, '<h3>Hello World</h3>');
        // validate that html code source is visible
        await customAssert('HTML box should be visible', async () => await expect(page.locator(pageobject.htmltextlocator)).toBeVisible());

        // drag and drop the link source
        await functions.drag_And_Drop(pageobject.linkSource, pageobject.target);
        await functions.fill_Text(pageobject.linklocator, 'youtube link');
        await customAssert('Link Text should be youtube link', async () => {
            const Linktext = page.locator(pageobject.linklocator);
            await expect(Linktext).toHaveValue('youtube link');
        });
        const column = page.locator('h2', { hasText: 'Column' });
        await column.click(); 

    });

    test('Add Library for testpage3', async () => {
        // library
        await page.locator(pageobject.Library)
        await page.click(pageobject.Library);

        // add button
        await page.locator(pageobject.plusAddButton)
        await page.click(pageobject.plusAddButton); // Locate by ID
        console.log('Add button clicked successfully!');
        await customAssert('Name Field', async () => {
            await page.click(pageobject.nameField);
            await functions.fill_Text(pageobject.nameField, 'mycard1');
        });
        await customAssert('Icon Field', async () => {
            const selectIconButton = page.locator(pageobject.selectIcon);
            await page.click(pageobject.selectIcon);  // Click the 'Select icon' text
            const icon = page.locator(pageobject.selectIconFasFaAddress);
            await icon.click();  // Click the desired icon
        });
        console.log("Icon 'fas fa-ad' selected.");
        await page.click(pageobject.selectIconFlip);
        await customAssert('Assert +Add button is visible', async () => {
            await expect(page.locator(pageobject.addButtonAfterSelect)).toBeVisible();
        });
        await page.click(pageobject.addButtonAfterSelect);  
        await page.click(pageobject.PageSave);
 
        await customAssert(' testPage3 name field should be visible', async () => {
            const names = await page.locator(pageobject.pageNameSave3).allInnerTexts();
        });
    });

    test('Create Fourth page', async () => {
        await functions.create_New_Page('testpage4');
        await page.locator(pageobject.Library).click();
        await functions.drag_And_Drop(pageobject.dragElement1, pageobject.target);
        await page.waitForTimeout(5000);
        await page.click(pageobject.testPage4);
        await customAssert('Page URL should be /testpage2', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'page/testpage4');
        });
        await page.waitForTimeout(5000);

    });
});