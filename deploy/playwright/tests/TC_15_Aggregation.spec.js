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

    // Add Aggregation to field on People list view
    test('Add Aggregation to field on People list view', async () => {
        await functions.views();
        await page.click(pageobject.configurePeopleList);
        await page.waitForTimeout(3000);
        // Click on add column button
        await page.click(pageobject.addcolumnbutton);
        await customAssert('Drag and drop Aggregation field on page', async () => {
            await functions.drag_And_Drop(pageobject.aggregationDiv, pageobject.newcolumn4);
        });
        // await page.click(pageobject.RelationDropdown);
        await customAssert('Select Task.assigned_to in relation dropdown', async () => {
            await page.selectOption(pageobject.RelationDropdown, { label: 'Task.assigned_to' });
        });
        await customAssert('Select id field in on field dropdown', async () => {
            const Childtablefield = await page.locator('select.form-control.form-select').nth(1);
            await Childtablefield.selectOption({ value: 'id' });
        });
        await customAssert('Select Count in static dropdown', async () => {
            const StatisticDropdown = await page.locator('select.form-control.form-select').nth(2);
            await StatisticDropdown.selectOption({ value: 'Count' });
        });
        await page.waitForTimeout(2000);
        await page.click(pageobject.nextoption);
        await functions.views();
        await page.click(pageobject.PeopleList);
        // await customAssert('count Task field should be visible on people list', async () => {
        //     await expect(page.locator(pageobject.countTaskLocator)).toBeVisible();
        // });
    });

    // Add Estimated hours field on Task table
    test('Add Estimated hours field on Task table', async () => {
        // click table button
        await functions.click_table();
        // Go to task table
        await page.click(pageobject.Tasktable);
        // click on add field button
        await page.click(pageobject.addFieldButtonLocator);
        // Fill the lable name
        await functions.fill_Text(pageobject.labelTextboxlocator, 'Estimated Hours');
        await customAssert('Select type key to employee ', async () => {
            const type1 = await page.$("#inputtype");
            await type1?.selectOption("Integer");
        });
        // Click on next button
        await functions.submit();
        await functions.fill_Text(pageobject.minInputLocator, '0');
        // Click on next button
        await functions.submit();
        await page.click(pageobject.EditlinkLocator);
        await customAssert('Input Estimated hours for every task ', async () => {
        await page.click(pageobject.estimatedHourscell);
        await page.keyboard.type('2');

        await page.click(pageobject.estimatedHourscell2);
        await page.keyboard.type('1');
        await page.waitForTimeout(1000);

        await page.click(pageobject.estimatedHourscell3);
        await page.keyboard.type('3');
        await page.waitForTimeout(2000);
        await functions.click_table();
        });
    });

    // Add Estimated hours on aggregation on people list
    test('Add Estimated hours on aggregation on people list', async () => {
        await functions.views();
        await page.click(pageobject.configurePeopleList);
        await page.waitForTimeout(3000);
        await page.click(pageobject.addcolumnbutton);
        await customAssert('Drag and drop Aggregation field on page', async () => {
            await functions.drag_And_Drop(pageobject.aggregationDiv, pageobject.newcolumn5);
        });
        await customAssert('Select id field in on field dropdown', async () => {
            const Childtablefield = await page.locator('select.form-control.form-select').nth(1);
            await Childtablefield.selectOption({ value: 'estimated_hours' });
        });
        await customAssert('Select Sum in static dropdown', async () => {
            const StatisticDropdown = await page.locator('select.form-control.form-select').nth(2);
            await StatisticDropdown.selectOption({ value: 'Sum' });
        });
        await page.waitForTimeout(3000);
        await page.click(pageobject.nextoption);
        await functions.views();
        await page.click(pageobject.PeopleList);
        await customAssert('Sum Task field should be visible on people list', async () => {
            await expect(page.locator(pageobject.SumTaskLocator)).toBeVisible();
        });
    });

    // Add Array_agg on aggregation on people list
    test('Add Array_agg on aggregation on people list', async () => {
        await functions.views();
        await page.click(pageobject.configurePeopleList);
        await page.waitForTimeout(3000);
        await page.click(pageobject.addcolumnbutton);
        await customAssert('Drag and drop Aggregation field on page', async () => {
            await functions.drag_And_Drop(pageobject.aggregationDiv, pageobject.newcolumn6);
        });
        await customAssert('Select name field in on field dropdown', async () => {
            const Childtablefield = await page.locator('select.form-control.form-select').nth(1);
            await Childtablefield.selectOption({ value: 'name' });
        });
        await customAssert('Select Array_Agg in static dropdown', async () => {
            const StatisticDropdown = await page.locator('select.form-control.form-select').nth(2);
            await StatisticDropdown.selectOption({ value: 'Array_Agg' });
        });
        await page.waitForTimeout(3000);
        await page.click(pageobject.nextoption);
        await functions.views();
        await page.click(pageobject.PeopleList);
        await customAssert('Sum Task field should be visible on people list', async () => {
            await expect(page.locator(pageobject.Array_AggLocator)).toBeVisible();
            await expect(page.getByText('Buy Milk')).toBeVisible();    
        });
    });

    // Add aggregation on people show view
    test('Add aggregation on people show view', async () => {
        await functions.views();
        await page.click(pageobject.configureShowPeople);
        await page.waitForTimeout(3000);
        // Remove the edit button
        await page.click(pageobject.editIconLocator);
        await page.click(pageobject.deletebutton);
        // remove the column
        await page.click(pageobject.target);
        await page.click(pageobject.deletebutton);
        await functions.drag_And_Drop(pageobject.columnsElement, pageobject.target);
        await functions.fill_Text(pageobject.numbercolumn, '2');
        await functions.drag_And_Drop(pageobject.textSource, pageobject.secondrowcolumn1);
        await functions.clearText(pageobject.richTextEditor);
        await page.keyboard.type('team');
        await functions.drag_And_Drop(pageobject.joinField, pageobject.secondrowcolumn);
        await customAssert('Select Name from teams for join field', async () => {
            await page.click(pageobject.fieldsButton);
            await page.click(pageobject.teamDropdownLocator);
            await page.click(pageobject.teamnameitem);
        });
        await functions.drag_And_Drop(pageobject.columnsElement, pageobject.target);
        await functions.fill_Text(pageobject.numbercolumn, '2');
        await functions.drag_And_Drop(pageobject.textSource, pageobject.secondrowcolumn1);
        await functions.clearText(pageobject.richTextEditor);
        await page.keyboard.type('Task Assigned');
        // await functions.fill_Text(pageobject.richTextEditor, 'Task Assigned');
        await functions.drag_And_Drop(pageobject.aggregationDiv, pageobject.secondrowcolumn);
        await customAssert('Select id field in on field dropdown', async () => {
            const Childtablefield = await page.locator('select.form-control.form-select').nth(1);
            await Childtablefield.selectOption({ value: 'id' });
        });
        await customAssert('Select Count in static dropdown', async () => {
            const StatisticDropdown = await page.locator('select.form-control.form-select').nth(2);
            await StatisticDropdown.selectOption({ value: 'Count' });
        });
        await page.waitForTimeout(3000);
        await page.click(pageobject.nextoption);
    });

    // Add Show person link on people list
    test('Add Show person link on people list', async () => {
        await functions.views();
        await page.click(pageobject.configurePeopleList);
        await page.waitForTimeout(3000);
        await page.click(pageobject.addcolumnbutton);
        await customAssert('Drag and drop Aggregation field on page', async () => {
            await functions.drag_And_Drop(pageobject.viewlinksource, pageobject.newcolumn7);
        });
        await customAssert('Select show_people on view to link dropdown', async () => {
            await page.click(pageobject.viewtolinkdropdown);
            await page.click(pageobject.view2showpeople);
        });
        await functions.fill_Text(pageobject.lebelforfield, 'Show');
        await page.waitForTimeout(3000);
        await page.click(pageobject.nextoption);
        await functions.views();
        await page.click(pageobject.PeopleList);
        await page.click(pageobject.showfieldlink);
    });

    // Create show team view 
    test('Create show team view', async () => {
        await functions.views();
        // click on create new view
        await page.click(pageobject.createnewview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'Show_Team');
        await page.fill(pageobject.discriptiontext, 'Show for team');
        // select show pattern
        await customAssert('Select show view pattern for view', async () => {
            const ShowPattern = await page.$("#inputviewtemplate");
            await ShowPattern?.selectOption("Show");
        });
        // Select teams table in table dropdown
        await customAssert('Select teams table for view', async () => {
            await page.selectOption(pageobject.viewtabledropdown, { label: 'Teams' });
        });
        // submit the page
        await functions.submit();
        await page.waitForTimeout(3000);
        await customAssert('Change text and field for first row as ID', async () => {
            await page.click(pageobject.nameDivLocator1);
            await functions.clearText(pageobject.richTextEditor);
            await page.keyboard.type('ID');
            await page.click(pageobject.maintenanceDiv);
            await page.click(pageobject.fielddropdown);
            // Select 'id' from the dropdown
            await page.selectOption('select.form-control.form-select', 'id');
        });
        await customAssert('drag new column and set column with', async () => {
            await functions.drag_And_Drop(pageobject.columnsElement, pageobject.target);
            await functions.fill_Text(pageobject.NumberInputW, '2');
        });
        await customAssert('Set right alignment from column setting', async () => {
            await page.click(pageobject.columnSettings);
            await page.click(pageobject.rightButtonalign);
        });
        await customAssert('Add text lable and field on column for name', async () => {
            await functions.drag_And_Drop(pageobject.textSource, pageobject.secondrowcolumn1);
            await functions.clearText(pageobject.richTextEditor);
            await page.keyboard.type('Name');
            await functions.drag_And_Drop(pageobject.fieldsourrce, pageobject.secondrowcolumn);
            await page.click(pageobject.fielddropdown);
            // Select name' from the dropdown
            await page.selectOption('select.form-control.form-select', 'name');
        });
        await page.waitForTimeout(3000);
        await page.click(pageobject.nextoption);
    });

    // Add link view for show team in show people view
    test('Add link view for show team in show people view', async () => {
        await functions.views();
        await page.click(pageobject.configureShowPeople);
        await page.waitForTimeout(3000);
        await functions.drag_And_Drop(pageobject.viewlinksource, pageobject.target);
        await customAssert('Select show_team on view to link dropdown', async () => {
            await page.click(pageobject.viewtolinkdropdown);
            await page.click(pageobject.view2showteam);
        });
        // Add lable for link
        await functions.fill_Text(pageobject.textInputLabel, 'Show team');
        await customAssert('Check open popup checkbox', async () => {
        await page.locator(pageobject.popupcheckbox).nth(1).click();
        });
        await page.waitForTimeout(3000);
        // click on next button
        await page.click(pageobject.nextoption);

        await functions.views();
        // Click to open people list
        await page.click(pageobject.PeopleList);
        // click on show link
        await page.click(pageobject.showfieldlink);
        // Click on show team link
        await page.click(pageobject.showTeamLink);
        // close the popup
        await page.click(pageobject.closeButtonLocator);
    });

    // Add view for show team in show people view
    test('Add view for show team in show people view', async () => {
        await functions.views();
        await page.click(pageobject.configureShowPeople);
        await page.waitForTimeout(3000);
        await page.click(pageobject.showTeamspan);
        await page.click(pageobject.deletebutton);
        await functions.drag_And_Drop(pageobject.viewsource, pageobject.target);
        await customAssert('Select show team view in view to show dropdown', async () => {
            await page.click(pageobject.View2Showdropdown);
            await page.click(pageobject.view2showteam, { force: true });
        });
        await page.waitForTimeout(3000);
        // click on next button
        await page.click(pageobject.nextoption);
        await functions.views();
        // Click to open people list
        await page.click(pageobject.PeopleList);
        // click on show link
        await page.click(pageobject.showfieldlink);
    });

    // Add show assigned task in show people
    test('Add show assigned task in show people', async () => {
        await functions.views();
        await page.click(pageobject.configureShowPeople);
        await page.waitForTimeout(3000);
        await page.click(pageobject.IDDivLocator);
        await page.click(pageobject.deletebutton);
        await functions.drag_And_Drop(pageobject.viewlinksource, pageobject.target);
        await customAssert('Select show_team on view to link dropdown', async () => {
            await page.click(pageobject.viewtolinkdropdown);
            await page.click(pageobject.view2tasklist);
        });
        // click on select button and select assignedto
        await customAssert('Select assigned to task to show task for person', async () => {
        await page.click(pageobject.selectButton);
        await page.locator(pageobject.assignedToItem).nth(1).click();
        });
        // Add lable for link
        await functions.fill_Text(pageobject.textInputLabel, 'List of assigned tasks');
        await page.waitForTimeout(3000);
        // click on next button
        await page.click(pageobject.nextoption);
        await functions.views();
        // Click to open people list
        await page.click(pageobject.PeopleList);
        // click on show link
        await page.click(pageobject.showfieldlink);
        await page.click(pageobject.listOfAssignedTasks);
        await customAssert('Assigned task for person should be visible', async () => {
            await expect(page.getByText('Buy Milk')).toBeVisible();
        });
    });
});
