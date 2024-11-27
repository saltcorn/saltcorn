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
        await page.waitForTimeout(5000);
        await customAssert('Add data on first row in task table ', async () => {
            // Click on add row button
            await page.click(pageobject.addrowlocator);
            await page.waitForSelector(pageobject.Nametab);
            await page.click(pageobject.Nametab);
            await page.keyboard.type('Buy Milk');
            await page.click(pageobject.Discriptiontab);
            await page.keyboard.type('Remember this is semi skimmed');
            await page.waitForTimeout(1000);
        });
        await customAssert('Add data on Second row in task table ', async () => {
            await page.click(pageobject.addrowlocator);
            await page.click(pageobject.Nametab);
            await page.keyboard.type('Take out trash');
            await page.click(pageobject.Discriptiontab);
            await page.keyboard.type('Thursday night');
            await page.waitForTimeout(1000);
        });
        await customAssert('Add data on third row in task table ', async () => {
            await page.click(pageobject.addrowlocator);
            await page.click(pageobject.Nametab);
            await page.keyboard.type('Empty Fridge');
            await page.click(pageobject.Discriptiontab);
            await page.keyboard.type('All the smelly stuff');
            await page.waitForTimeout(1000);
        });
        await customAssert('Add status for every task in table ', async () => {
            await page.click(pageobject.statustab);
            await page.click('text=Backlog');
            await page.click(pageobject.statusCell2);
            await page.click('text=InProgress');
            await page.click(pageobject.statusCell3);
            await page.click('text=Iteration');
            await page.waitForTimeout(2000);
        });
    });

    // Create show view for Task table
    test('Create show view for Task table', async () => {
        await functions.views();
        // click on create new view
        await page.waitForSelector(pageobject.createnewview);
        await page.click(pageobject.createnewview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'ShowTask');
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
        await customAssert('Delete all content from view ', async () => {
            // select target
            await page.click(pageobject.target);
            // delete containts
            await page.click(pageobject.deletebutton); //deletecontentButton
        });
        await customAssert('Drag and drop field source on target ', async () => {
            // drag field source on column
            await functions.drag_And_Drop(pageobject.fieldsource, pageobject.target);
            await functions.drag_And_Drop(pageobject.fieldsource, pageobject.target);
            await page.click(pageobject.firstfield);
            await page.selectOption(pageobject.fielddropdown, { label: 'Name' });
            // select text style as heading 4 for task name
            await page.click("button.style-h4");
        });
        await page.waitForTimeout(4000);
        // click on next button
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
        // input view name and discription
        await page.fill(pageobject.InputName, 'Kanban_Board');
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
            await page.selectOption(pageobject.Cardviewdropdown, { label: 'ShowTask' });
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
        await page.click(pageobject.kanbanboardlink);
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
        await page.click(pageobject.configurekanban);
        // add position in kanban board
        await customAssert('Select Position for Positions Field dropdown', async () => {
            await page.selectOption(pageobject.PositionFieldDropdown, 'position');
        });
        await functions.submit();

        // Go to kanban board
        await page.click(pageobject.kanbanboardlink);
        // drag and drop a task card on different container status and reload the page
        await functions.drag_And_Drop(pageobject.TaskCard2, pageobject.iterationstatus);
        await page.reload();
        await functions.drag_And_Drop(pageobject.TaskCard1, pageobject.InProgressStatus);
        await page.reload();
        await functions.drag_And_Drop(pageobject.TaskCard3, pageobject.InProgressStatus);
        await page.reload();
    });
});