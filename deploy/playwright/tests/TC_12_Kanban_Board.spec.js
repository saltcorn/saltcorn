const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');
const customAssert = require('../pageobject/utils.js');
const Logger = require('../pageobject/logger.js');

test.describe.serial('E2E Test Suite', () => {
    let functions;
    let pageobject;
    let context;
    let page;
    let randomString;
    let showViewName;
    let kanbanViewName;

    test.beforeAll(async ({ browser }) => {
        randomString = PageFunctions.generate_Random_String(10);
        showViewName = 'ShowTask_' + randomString;
        kanbanViewName = 'Kanban_Board_' + randomString;
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

    // Create the Task table
    test('Create task table', async () => {
        await functions.clear_Data();
        // click table button
        await functions.click_table();
        // Click the "Create table" button
        await page.click(pageobject.createtablebutton);
        // Enter Table name
        await functions.fill_Text(pageobject.InputName, 'Task');
        // click on Create button
        await page.click(pageobject.submitButton);
        await customAssert('Create Name field in task table ', async () => {
            // click on add field button
            await page.click(pageobject.addFieldButtonLocator);
            // Fill the lable name
            await functions.fill_Text(pageobject.labelTextboxlocator, 'Name');
            // Fill the discription
            await functions.fill_Text(pageobject.descriptionSelector, 'Name of Task');
            await page.check(pageobject.Uniquecheckbox);
            // Click on next button
            await functions.submit();
        });
        // click on next button
        await functions.submit();
        // click on finish button
        await functions.submit();
        await customAssert('Create Discription field in task table ', async () => {
            // click on add field button
            await page.click(pageobject.addFieldButtonLocator);
            // Fill the lable name
            await functions.fill_Text(pageobject.labelTextboxlocator, 'Discription');
            // Fill the discription
            await functions.fill_Text(pageobject.descriptionSelector, 'Discription of Task');
            // Click on next button
            await functions.submit();
        });
        // click on next button
        await functions.submit();
        // click on finish button
        await functions.submit();
        await customAssert('Create Status field in task table ', async () => {
            // click on add field button
            await page.click(pageobject.addFieldButtonLocator);
            // Fill the lable name
            await functions.fill_Text(pageobject.labelTextboxlocator, 'Status');
            // Fill the discription
            await functions.fill_Text(pageobject.descriptionSelector, 'Status of Task');
            // Click on next button
            await functions.submit();
            // Fill the status option in option field
            await functions.fill_Text(pageobject.optioninput, 'Backlog, Iteration, InProgress, Review, Done');
            // click on next button
            await functions.submit();
        });
        // click on finish button
        await functions.submit();
    });

    // Input data in Task table
    test('Input data in Task table', async () => {
        // click table button
        await functions.click_table();
        // Go to task table
        await page.click(pageobject.Tasktable);
        // Click on edit link
        await page.click(pageobject.EditlinkLocator);
        await page.waitForTimeout(2500);
        await customAssert('Add data on first row in task table ', async () => {
            // Click on add row button
            await page.click(pageobject.addrowlocator);
            await page.waitForSelector(pageobject.Nametab);
            await page.click(pageobject.Nametab);
            await page.keyboard.type('Buy Milk');
            await page.click(pageobject.Discriptiontab);
            await page.keyboard.type('Remember this is semi skimmed');
            await page.waitForTimeout(500);
        });
        await customAssert('Add data on Second row in task table ', async () => {
            await page.click(pageobject.addrowlocator);
            await page.click(pageobject.Nametab);
            await page.keyboard.type('Take out trash');
            await page.click(pageobject.Discriptiontab);
            await page.keyboard.type('Thursday night');
            await page.waitForTimeout(500);
        });
        await customAssert('Add data on third row in task table ', async () => {
            await page.click(pageobject.addrowlocator);
            await page.click(pageobject.Nametab);
            await page.keyboard.type('Empty Fridge');
            await page.click(pageobject.Discriptiontab);
            await page.keyboard.type('All the smelly stuff');
            await page.waitForTimeout(500);
        });
        await customAssert('Add status for every task in table ', async () => {
            await page.click(pageobject.statustab);
            await page.click('text=Backlog');
            await page.locator(pageobject.statustab).nth(1).click();
            await page.click('text=InProgress');
            await page.locator(pageobject.statustab).nth(2).click();
            await page.click('text=Iteration');
            await page.waitForTimeout(1000);
        });
    });

    // Create show view for Task table
    test('Create show view for Task table', async () => {
        test.setTimeout(60000);
        await functions.views();
        // click on create new view
        await page.waitForSelector(pageobject.createnewview);
        await page.click(pageobject.createnewview);
        // input view name and discription (with random suffix)
        await page.fill(pageobject.InputName, showViewName);
        await page.fill(pageobject.discriptiontext, 'Show view for task table');
        // validate the view pattern in table dropdown
        await customAssert('View Pattern should be Show', async () => {
            // select show pattern
            const ShowPattern = await page.$("#inputviewtemplate");
            await ShowPattern?.selectOption("Show");
        });

        // validate the table name in table dropdown
        await customAssert('Select task table to create show view', async () => {
            await page.selectOption(pageobject.viewtabledropdown, { label: 'Task' });
        });
        // submit the page
        await functions.submit();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Delete all existing rows/columns until canvas is clear
        await customAssert('Delete all content until canvas is clear', async () => {
            const deleteBtn = page.locator(pageobject.deletebutton);
            for (let i = 0; i < 20; i++) {
                const canvasHasContent = await page.locator(pageobject.target).locator('> div').count() > 0;
                if (!canvasHasContent) break;
                await page.click(pageobject.target);
                await page.waitForTimeout(400);
                if (!await deleteBtn.first().isVisible().catch(() => false)) break;
                await deleteBtn.first().click();
                await page.waitForTimeout(600);
            }
        });

        // Drag first field to canvas
        await customAssert('Drag first field to canvas', async () => {
            await functions.drag_And_Drop(pageobject.fieldsource, pageobject.target);
            await page.waitForTimeout(1500);
        });

        // Click field, select Name, apply H4
        await customAssert('Select Name and set H4 style', async () => {
            const fieldInCanvas = page.locator(pageobject.target).locator('div.d-inline-block').first();
            await fieldInCanvas.waitFor({ state: 'visible', timeout: 10000 });
            await fieldInCanvas.click();
            await page.waitForTimeout(1500);
            await page.locator('select.field').first().waitFor({ state: 'visible', timeout: 10000 });
            await page.locator('select.field').first().selectOption({ label: 'Name' });
            await page.click('button.style-h4');
            await page.waitForTimeout(1000);
        });

        // Drag second field below first column
        await customAssert('Drag second field below first column', async () => {
            await functions.drag_And_Drop(pageobject.fieldsource, pageobject.target);
            await page.waitForTimeout(1500);
        });

        // Save
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);
    });

    // Install kanban module and make kanban view
    test('Install kanban module and make kanban view', async () => {
        await functions.install_kanban();
        await functions.views();
        // click on create new view
        await page.waitForSelector(pageobject.createnewview);
        await page.click(pageobject.createnewview);
        // input view name and discription (with random suffix)
        await page.fill(pageobject.InputName, kanbanViewName);
        await page.fill(pageobject.discriptiontext, 'Kanban board for task table');
        // validate the view pattern in table dropdown
        await customAssert('View Pattern should be Kanban', async () => {
            // select show pattern
            const ShowPattern = await page.$("#inputviewtemplate");
            await ShowPattern?.selectOption("Kanban");
        });

        // validate the table name in table dropdown
        await customAssert('Select task table to create show view', async () => {
            await page.selectOption(pageobject.viewtabledropdown, { label: 'Task' });
        });
        // submit the page
        await functions.submit();
        await customAssert('Select Showtask for card view', async () => {
            await page.selectOption(pageobject.Cardviewdropdown, { label: showViewName });
        });
        await customAssert('Select Status for Columns by dropdown', async () => {
            await page.selectOption(pageobject.columnsbydropdown, { label: 'status' });
        });
        await functions.submit();
    });

    // Perform action in kanban board 
    test('Perform action in kanban board ', async () => {
        await functions.views();
        // Go to kanban board
        await page.locator(`a[href="/view/${kanbanViewName}"]`).first().click();
        // drag and drop taskcard on review status
        await functions.drag_And_Drop(pageobject.TaskCard2, pageobject.reviewstatus);
        // drag and drop taskcard on iteration status and reload
        await functions.drag_And_Drop(pageobject.TaskCard3, pageobject.iterationstatus);
        await page.reload();
    });

    // Add position field in task table and add on kanban board
    test('Add position field in task table and add on kanban board', async () => {
        // click table button
        await functions.click_table();
        // Go to task table
        await page.click(pageobject.Tasktable);
        await customAssert('Create Position field in task table ', async () => {
            // click on add field button
            await page.click(pageobject.addFieldButtonLocator);
            // Fill the lable name
            await functions.fill_Text(pageobject.labelTextboxlocator, 'Position');
            // Fill the discription
            await functions.fill_Text(pageobject.descriptionSelector, 'Position of Task');
            // select the input type
            const type = await page.$("#inputtype");
            await type?.selectOption("Float");
            // Click on next button
            await functions.submit();
        });
        // click on next button
        await functions.submit();
        // click on finish button
        await functions.submit();

        await functions.views();
        await page.locator(`a[href="/viewedit/config/${kanbanViewName}"]`).first().click();
        // add position in kanban board
        await customAssert('Select Position for Positions Field dropdown', async () => {
            await page.selectOption(pageobject.PositionFieldDropdown, 'position');
        });
        await functions.submit();

        // Go to kanban board
        await page.locator(`a[href="/view/${kanbanViewName}"]`).first().click();
        // drag and drop a task card on different container status and reload the page
        await functions.drag_And_Drop(pageobject.TaskCard2, pageobject.iterationstatus);
        await page.reload();
        await functions.drag_And_Drop(pageobject.TaskCard1, pageobject.InProgressStatus);
        await page.reload();
        await functions.drag_And_Drop(pageobject.TaskCard3, pageobject.InProgressStatus);
        await page.reload();
    });
});