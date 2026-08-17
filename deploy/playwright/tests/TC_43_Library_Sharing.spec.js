const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');
const customAssert = require('../pageobject/utils.js');
const Logger = require('../pageobject/logger.js');

// Covers the "shared/linked Library component" feature: a component placed
// from the Library sidebar onto more than one page stays linked to its
// _sc_library row, so editing the placement on one page and saving updates
// what every other page renders (last write wins, visible after reload -
// there is no live-update push or conflict handling in this first version).
test.describe('E2E Test Suite - Library sharing', () => {
    let functions;
    let pageobject;
    let context;
    let page;

    test.beforeAll(async ({ browser }) => {
        Logger.initialize();

        context = await browser.newContext({ ignoreHTTPSErrors: true });
        page = await context.newPage();

        await page.setViewportSize({ width: 1350, height: 720 });

        functions = new PageFunctions(page);
        pageobject = new PageObject(page);

        await functions.navigate_To_Base_URL(baseURL, derivedURL);
        await functions.login('myproject19july@mailinator.com', 'myproject19july');
        await functions.submit();
    });

    test.afterAll(async () => {
        await page.close();
        await context.close();
    });

    // The CKEditor-backed text field does not accept plain page.fill() -
    // it needs a real focus + keystroke sequence to commit the change back
    // to the underlying Craft.js node, so this replaces functions.fill_Text
    // wherever the actual saved/rendered value matters (not just visibility).
    const typeText = async (newText) => {
        const field = page.locator("div[contenteditable='true'][role='textbox']");
        await field.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.type(newText, { delay: 15 });
        await page.waitForTimeout(200);
        await page.locator(pageobject.target).click({ position: { x: 5, y: 5 } });
        await page.waitForTimeout(300);
    };

    test('Create source page and save its text as a Library component', async () => {
        await functions.create_New_Page('sharelib_source');
        await page.waitForSelector(pageobject.textSource);
        await functions.drag_And_Drop(pageobject.textSource, pageobject.target);
        await page.waitForTimeout(300);
        await typeText('Original shared text');
        await customAssert('Text shows the typed content', async () => {
            await expect(page.locator(pageobject.target)).toContainText('Original shared text');
        });

        await page.locator(pageobject.target).getByText('Original shared text').click();
        await page.click(pageobject.Library);
        await page.click(pageobject.plusAddButton);
        await customAssert('Name Field', async () => {
            await page.click(pageobject.nameField);
            await functions.fill_Text(pageobject.nameField, 'SharedGreeting');
        });
        await customAssert('Icon Field', async () => {
            await page.click(pageobject.selectIcon);
            await page.locator(pageobject.selectIconFasFaAdjust).click();
        });
        await page.click(pageobject.selectIconFlip);
        await customAssert('Assert +Add button is visible', async () => {
            await expect(page.locator(pageobject.addButtonAfterSelect)).toBeVisible();
        });
        await page.click(pageobject.addButtonAfterSelect);
        await page.click(pageobject.PageSave);

        await customAssert('sharelib_source should be in the page list', async () => {
            const names = await page.locator(pageobject.pageNameSave).allInnerTexts();
            console.assert(names.includes('sharelib_source'), '"sharelib_source" is missing from the Name column!');
        });
    });

    test('Place the shared component on page A', async () => {
        await functions.create_New_Page('sharelib_pagea');
        await page.click(pageobject.Library);
        await page.waitForSelector(pageobject.dragLibraryAdjustIcon, { state: 'visible', timeout: 15000 });
        await functions.drag_And_Drop(pageobject.dragLibraryAdjustIcon, pageobject.target);

        await customAssert('Placed component shows the shared text on page A', async () => {
            await expect(page.locator(pageobject.target)).toContainText('Original shared text');
        });

        await page.click(pageobject.PageSave);
        await customAssert('sharelib_pagea should be in the page list', async () => {
            const names = await page.locator(pageobject.pageNameSave).allInnerTexts();
            console.assert(names.includes('sharelib_pagea'), '"sharelib_pagea" is missing from the Name column!');
        });

        await page.goto(`${baseURL}${derivedURL}page/sharelib_pagea`);
        await customAssert('Live page A renders the original shared text', async () => {
            await expect(page.getByText('Original shared text')).toBeVisible();
        });
    });

    test('Place and edit the shared component on page B, then verify page A picks up the change', async () => {
        await functions.navigate_To_Base_URL(baseURL, derivedURL);
        await functions.create_New_Page('sharelib_pageb');
        await page.click(pageobject.Library);
        await page.waitForSelector(pageobject.dragLibraryAdjustIcon, { state: 'visible', timeout: 15000 });
        await functions.drag_And_Drop(pageobject.dragLibraryAdjustIcon, pageobject.target);

        await customAssert('Placed component shows the shared text on page B', async () => {
            await expect(page.locator(pageobject.target)).toContainText('Original shared text');
        });

        // select the already-placed text node before editing it (a fresh drop
        // auto-selects, but a linked placement's children do not)
        await page.locator(pageobject.target).getByText('Original shared text').click();
        await page.waitForTimeout(200);
        await typeText('Updated shared text');
        await customAssert('Text on page B should now read the updated text', async () => {
            await expect(page.locator(pageobject.target)).toContainText('Updated shared text');
        });

        await page.click(pageobject.PageSave);
        await customAssert('sharelib_pageb should be in the page list', async () => {
            const names = await page.locator(pageobject.pageNameSave).allInnerTexts();
            console.assert(names.includes('sharelib_pageb'), '"sharelib_pageb" is missing from the Name column!');
        });

        // last write wins, visible only after reload - no live push in this
        // first version, so re-navigating to page A is the actual test
        await page.goto(`${baseURL}${derivedURL}page/sharelib_pagea`);
        await customAssert('Live page A now renders the text updated from page B', async () => {
            await expect(page.getByText('Updated shared text')).toBeVisible();
        });
    });
});
