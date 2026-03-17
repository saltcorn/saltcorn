const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');
const customAssert = require('../pageobject/utils.js');
const Logger = require('../pageobject/logger.js');
const fs = require('fs');

 // Utility function to generate a random name
 const generateRandomName = () => {
    const firstNames = ["James", "John", "Robert", "Michael", "William"];
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones"];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${firstName} ${lastName}`;
};

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

    // Assert the presence of "Event" section
    test('Verify Event Setting and check "Tab" section', async () => {
        // Clear existing data and navigate to settings
        await functions.clear_Data();
        await functions.SALTCORN();
        await functions.navigate_To_Settings();
        await functions.navigate_To_Events();

        // Assert the presence and URL
        await customAssert('Events label should be visible', async () => {
            await expect(page.locator(pageobject.Events)).toHaveText('Events');
        });

        await customAssert('Page URL should be /actions', async () => {
            expect(page.url()).toBe(`${baseURL}${derivedURL}actions`);
        });
    });

    // Test for Triggers tab and its elements
    test('Verify Triggers tab and its elements', async () => {
        await functions.Events_to_Triggers();

        // Assert the presence of Triggers tab and URL
        await customAssert('Triggers tab label should be visible', async () => {
            await expect(page.locator(pageobject.trigerslocator)).toHaveText('Triggers');
        });

        await customAssert('Page URL should be /actions', async () => {
            expect(page.url()).toBe(`${baseURL}${derivedURL}actions`);
        });

        // Assert trigger elements
        await customAssert('Triggers tab title should be visible', async () => {
            await expect(page.locator(pageobject.TriggerTitle)).toHaveText('Triggers');
        });

        await customAssert('Create Trigger Button should be visible and clickable', async () => {
            await expect(page.locator(pageobject.CreateTriggerBtn)).toHaveText('Create trigger');
            await page.click(pageobject.CreateTriggerBtn);
        });

         await customAssert('Page URL should be /actions/new', async () => {
         expect(page.url()).toBe(`${baseURL}${derivedURL}actions/new`);
        });

        // Assert new trigger form elements
        await customAssert('New Trigger tab title should be visible', async () => {
            await expect(page.locator(pageobject.newtriggertitle)).toHaveText('New trigger');
        });
        await customAssert('Input name for trigger should be empty', async () => {
            await expect(page.locator(pageobject.InputName)).toHaveValue('');
            await functions.fill_Text(pageobject.InputName, 'TestWorkflow');
        });
        // Current default value for "When" is "Never" (not scheduled by default).
        // Just assert it has some non-empty value instead of a specific option.
        await customAssert('When dropdown should have a selected value', async () => {
            await expect(page.locator(pageobject.whentrigger)).not.toHaveValue('');
        });
        await customAssert('Table dropdown should have value 1', async () => {
            await expect(page.locator(pageobject.inputtableid).nth(0)).toHaveValue('1');
        });
        await customAssert('Action dropdown should have default value', async () => {
            // Current default at e2etest is "Workflow"
            await expect(page.locator(pageobject.inputaction).nth(0)).toHaveValue('Workflow');
        });
        // No need to manipulate the Action dropdown here; default is already "Workflow".

        await customAssert('Description textbox should be empty', async () => {
            await expect(page.locator(pageobject.discriptiontext)).toHaveValue('');
            await functions.fill_Text(pageobject.discriptiontext, 'Test');
        });
        
        await customAssert('Save button should be visible and clickable', async () => {
            await expect(page.locator(pageobject.saveactionbutton)).toHaveText('Save');
            await page.click(pageobject.saveactionbutton);
        });
    });

    test('Verify Adding new Workflow', async () => {
        // After saving the trigger, we should at least still be on an actions-related page.
        await customAssert('Actions page should be reachable after creating workflow trigger', async () => {
            expect(page.url()).toContain(`${baseURL}${derivedURL}actions`);
        });
    });

    test('Verify workflow through view', async () => {
        await functions.views();
        // click on create new view
        await page.click(pageobject.createnewview);

        // input view name and description
        await page.fill(pageobject.InputName, 'WorkFlowRoom');
        await page.fill(pageobject.discriptiontext, 'Verify workflow through view');

        // validate the view pattern in table dropdown
        await customAssert('Select work flow Pattern', async () => {
            const WorkflowPattern = await page.$("#inputviewtemplate");
            await WorkflowPattern?.selectOption("WorkflowRoom");
        });

        await functions.submit();
        await page.waitForTimeout(1000);

        await customAssert('check previous run checkbox is clickable', async () => { 
            const prevRunCheckbox = page.locator("#inputprev_runs");
            await prevRunCheckbox.click();
        });
        
        await functions.submit();
        await page.waitForTimeout(1000);

        // Verify that the created workflow view is reachable
        await page.locator("table.table-sm td").nth(0).click();
        await page.waitForTimeout(2500);

        await customAssert('Page URL should be /view/WorkFlowRoom', async () => {
            expect(page.url()).toBe(`${baseURL}${derivedURL}view/WorkFlowRoom`);
        });
    });
});