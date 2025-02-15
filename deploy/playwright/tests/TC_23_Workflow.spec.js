const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');
const customAssert = require('../pageobject/utils.js');
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
        await customAssert('Actions Available cell should be visible', async () => {
            await expect(page.locator(pageobject.actionsAvailable)).toHaveText('Actions available');
        });
        await customAssert('Event Types cell should be visible', async () => {
            await expect(page.locator(pageobject.eventTypesCell)).toHaveText('Event types');
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
        await customAssert('When dropdown should have Insert value', async () => {
            await expect(page.locator(pageobject.whentrigger)).toHaveValue('Insert');
        });
        await customAssert('Table dropdown should have value 1', async () => {
            await expect(page.locator(pageobject.inputtableid).nth(0)).toHaveValue('1');
        });
        await customAssert('Action dropdown should have value blocks', async () => {
            await expect(page.locator(pageobject.inputaction).nth(0)).toHaveValue('blocks');
        });
        await customAssert('Action dropdown should have value blocks', async () => {
            // Wait for the dropdown to be visible
            await page.waitForSelector('label[for="inputaction"]');

            // Click the "Action" label to focus the dropdown
            await page.click('label[for="inputaction"]');

            // Click the dropdown to open it
            await page.click('select#inputaction');

            // Scroll to the bottom of the dropdown
            await page.evaluate(() => {
                const dropdown = document.querySelector('select#inputaction');
                dropdown.scrollTop = dropdown.scrollHeight;
            });

            // Select "Workflow" option
            await page.selectOption('select#inputaction', { label: 'Workflow' });

            // Wait for a second to see the selection (optional)
            await page.waitForTimeout(1000);
        });
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

        //Configure workflow Click the "Add step" button
        await customAssert('click add new step', async () => {
            await page.click(pageobject.addstep);
        });
        await customAssert('step edit url', async () => {
            const currentURL = page.url();
            expect(currentURL).toMatch(new RegExp(`${baseURL}${derivedURL}actions/stepedit/\\d+\\?initial_step=true`));
        });
        await customAssert('fill CTX value', async () => {
            await page.locator(pageobject.ctxvalues).fill("{x:1}");
        });
        await functions.submit();

        await customAssert('Add next step 2', async () => {
            await page.waitForLoadState('networkidle');
            const addButton = page.locator(pageobject.newstep);
            await addButton.click();
        });

        await customAssert('Action dropdown should have value blocks', async () => {
            // Wait for the dropdown to be visible
            await page.waitForSelector('label[for="inputwf_action_name"]');
        
            // Click the "Action" label to focus the dropdown
            await page.click('label[for="inputwf_action_name"]');
        
            // Click the dropdown to open it
            await page.click('select#inputwf_action_name');
        
            // Scroll to the bottom of the dropdown (ensures "Output" is visible)
            await page.evaluate(() => {
                const dropdown = document.querySelector('select#inputwf_action_name');
                dropdown.scrollTop = dropdown.scrollHeight;
            });
        
            // Select "Output" option from the dropdown
            await page.selectOption('select#inputwf_action_name', { value: 'UserForm' });
        
            // Optional: Wait to confirm selection
            await page.waitForTimeout(1000);
        });
        
        // Fill 'Label' field with 'what is your name'
        await page.fill('input[data-fieldname="label"]', 'what is your name');

        // Fill 'Variable name' field with 'name'
        await page.fill('input[data-fieldname="var_name"]', 'name');

        // Select 'Free text' from Input Type dropdown
        await page.selectOption('select[data-fieldname="qtype"]', { label: 'Free text' });


        await functions.submit();

        await customAssert('Add next step 3', async () => {
            await page.waitForTimeout(2000);
            await page.waitForSelector('.edgeLabel .label .edgeLabel .add-btw-nodes');
            const addButton = page.locator('.edgeLabel .label .edgeLabel .add-btw-nodes').nth(1);
            await addButton.waitFor({ state: 'visible' });
            await addButton.click();
        });

        // const plusIcon = page.locator('i.fas.fa-plus.with-link');
        // await plusIcon.click();

         await functions.submit();

        await customAssert('Add next step 4', async () => {
            await page.waitForLoadState('networkidle');
            const addButton = page.locator('.nodeLabel .fa-plus');
            await addButton.waitFor({ state: 'visible' });
            await addButton.click();
        });
        
        await customAssert('Action dropdown should have value blocks', async () => {
            // Wait for the dropdown to be visible
            await page.waitForSelector('label[for="inputwf_action_name"]');
        
            // Click the "Action" label to focus the dropdown
            await page.click('label[for="inputwf_action_name"]');
        
            // Click the dropdown to open it
            await page.click('select#inputwf_action_name');
        
            // Scroll to the bottom of the dropdown (ensures "Output" is visible)
            await page.evaluate(() => {
                const dropdown = document.querySelector('select#inputwf_action_name');
                dropdown.scrollTop = dropdown.scrollHeight;
            });
        
            // Select "Output" option from the dropdown
            await page.selectOption('select#inputwf_action_name', { value: 'Output' });
        
            // Optional: Wait to confirm selection
            await page.waitForTimeout(1000);
        });
        
        await customAssert("fill Outbox value", async () => {
            await page.locator("#inputoutput_text").fill("###Greetings!\n\nHello {{ name }}");
        });
        await customAssert('check markdown checkbox', async () => {
            const checkbox = page.locator('#inputmarkdown');
            await checkbox.waitFor({ state: 'visible' });
            await checkbox.click();
        });
        await functions.submit();

        await page.waitForLoadState('networkidle');
        await page.click('a[href^="/actions/testrun/"]');

        await page.waitForLoadState('networkidle');
        await page.click('label[for="inputname"]');
        await page.fill('#inputname', 'John Doe');


        const submitButton = page.locator('button.btn.btn-primary');
        await submitButton.click();


        await customAssert('Verify modal header text', async () => {
            await page.waitForTimeout(2000);
            await page.waitForLoadState('networkidle');
            const headerText = await page.locator('.modal-header .modal-title').textContent();
            await page.waitForSelector('.modal-header .modal-title');
            expect(headerText.trim()).toBe('Workflow output');
        });

        await page.click('.btn.btn-primary');
        


        
        
    
    });

});