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

    // Create person task badges view
    test('Create person task badges view', async () => {
        await functions.install_badges();
        await functions.views();
        // click on create new view
        await page.click(pageobject.createnewview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'PersonTaskBadges');
        await page.fill(pageobject.discriptiontext, 'badges for person');
        // select show pattern
        await customAssert('Select Badges view pattern for view', async () => {
            const ShowPattern = await page.$("#inputviewtemplate");
            await ShowPattern?.selectOption("Badges");
        });
        // Select People table in table dropdown
        await customAssert('Select People table for view', async () => {
            await page.selectOption(pageobject.viewtabledropdown, { label: 'People' });
        });
        // submit the page
        await functions.submit();
        await customAssert('Select task assigned to name in relation dropdown', async () => {
            await page.selectOption(pageobject.inputrelation, { label: 'Task.assigned_to→name' });
        });
        // submit the page
        await functions.submit();
    });

    // Add badges view in show people
    test('Add badges view in show people', async () => {
        await functions.views();
        await page.click(pageobject.configureShowPeople);
        await page.waitForTimeout(5000);
        await functions.drag_And_Drop(pageobject.viewsource, pageobject.target);
        await customAssert('Select task badge view in view to show dropdown', async () => {
            await page.click(pageobject.View2Showdropdown);
            await page.click(pageobject.view2taskbadge, { force: true });
        });
        await page.waitForTimeout(5000);
        await page.click(pageobject.nextoption);

        await functions.views();
        await page.click(pageobject.PeopleList);
        await page.waitForTimeout(5000);
        await page.click(pageobject.showfieldlink);
        await customAssert('Task badge should be visible on people list', async () => {
            await expect(page.locator(pageobject.badgeLocator)).toBeVisible();
        });
    });

    // Create Task helper table
    test('Create Task helper table', async () => {
        // click table button
        await functions.click_table();
        await page.click(pageobject.createtablebutton);
        await functions.fill_Text(pageobject.InputName, 'Task_Helper');
        await page.click(pageobject.submitButton);
        await page.click(pageobject.addFieldButtonLocator);
        // Fill the lable name 
        await functions.fill_Text(pageobject.labelTextboxlocator, 'Helper');
        // select the input type
        await customAssert('Select type key to People ', async () => {
            const type1 = await page.$("#inputtype");
            await type1?.selectOption("Key to People");
        });
        // Click on next button
        await functions.submit();
        await customAssert('Select Name on summary field', async () => {
            await page.selectOption(pageobject.summaryFieldSelect, { label: 'Full name [String]' });
        });
        // Click on next button
        await functions.submit();

        await page.click(pageobject.addFieldButtonLocator);
        // Fill the lable name
        await functions.fill_Text(pageobject.labelTextboxlocator, 'Task');
        // select the input type
        await customAssert('Select type key to Task ', async () => {
            const type1 = await page.$("#inputtype");
            await type1?.selectOption("Key to Task");
        });
        // Click on next button
        await functions.submit();
        await customAssert('Select Name on summary field', async () => {
            await page.selectOption(pageobject.summaryFieldSelect, { label: 'Name [String]' });
        });
        // Click on next button
        await functions.submit();
    });

    // Add data in task helper table
    test('Add data in task helper table', async () => {
        // click table button
        await functions.click_table();
        await page.click(pageobject.taskHelper);
        await page.click(pageobject.EditlinkLocator);
        await page.waitForTimeout(5000);
        // click on add row button

        await customAssert('Select name for helper', async () => {
            await page.click(pageobject.addrowlocator);
            await page.waitForTimeout(1000);
            await page.click(pageobject.HelperCell);
            await page.waitForTimeout(1000);
            await page.click('text=Adam', { force: true });
            await page.waitForTimeout(5000);

            await page.click(pageobject.addrowlocator);
            await page.click(pageobject.HelperCell);
            await page.click('text=Brandon');
            await page.waitForTimeout(1000);

            await page.click(pageobject.addrowlocator);
            await page.click(pageobject.HelperCell);
            await page.click('text=Cherry');
            await page.waitForTimeout(1000);
        });

        await customAssert('Select task for person', async () => {
            await page.click(pageobject.TaskCell);
            await page.click('text=Buy Milk');
            await page.click(pageobject.TaskCell2);
            await page.click('text=Take out trash');
            await page.click(pageobject.TaskCell3);
            await page.click('text=Empty Fridge');
            await page.waitForTimeout(1000);
        });
    });

    // Create Edit helper view
    test('Create Edit helper view', async () => {
        await functions.views();
        // click on create new view
        await page.click(pageobject.createnewview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'Edit_Helper');
        // select show pattern
        await customAssert('Select EditBadges view pattern for view', async () => {
            const ShowPattern = await page.$("#inputviewtemplate");
            await ShowPattern?.selectOption("EditBadges");
        });
        // Select People table in table dropdown
        await customAssert('Select People table for view', async () => {
            await page.selectOption(pageobject.viewtabledropdown, { label: 'People' });
        });
        // submit the page
        await functions.submit();
        await customAssert('Select task assigned to name in relation dropdown', async () => {
            await page.selectOption(pageobject.inputrelation, { label: 'Task_Helper.helper→task→name' });
        });
        // submit the page
        await functions.submit();
    });

    // Add task helper in show people
    test('Add task helper in show people', async () => {
        await functions.views();
        await page.click(pageobject.configureShowPeople);
        await page.waitForTimeout(5000);
        await page.click(pageobject.txttaskbadge);
        // await functions.drag_And_Drop(pageobject.viewsource, pageobject.target);
        await customAssert('Select task badge view in view to show dropdown', async () => {
            await page.click(pageobject.View2Showdropdown);
            await page.click(pageobject.view2editHelper, { force: true });
        });
        await page.waitForTimeout(5000);
        await page.click(pageobject.nextoption);

        await functions.views();
        // Click to open people list
        await page.waitForTimeout(5000);
        await page.click(pageobject.PeopleList);
        // click on show link
        await page.click(pageobject.showfieldlink);
        // Remove existing badge from people show page
        await page.click(pageobject.closeIcon);
        // click on plus button to to add badge for person
        await customAssert('Add new task badge for person', async () => {
            await page.click(pageobject.plusIconbadge);
            await page.click('text=Buy Milk');
            await page.waitForTimeout(1000);
        });
    });
});