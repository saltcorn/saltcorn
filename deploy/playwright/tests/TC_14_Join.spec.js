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

  // Add Assigned to field on task table
  test('Add Assigned to field on task table', async () => {
    // click table button
    await functions.click_table();
    // Go to task table
    await page.click(pageobject.Tasktable);
    // click on add field button
    await page.click(pageobject.addFieldButtonLocator);
    // Fill the lable name
    await functions.fill_Text(pageobject.labelTextboxlocator, 'assigned_to');
    // Fill the discription
    await functions.fill_Text(pageobject.descriptionSelector, 'task assigned to');
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
    await customAssert('Select Set null On delete of parant row ', async () => {
      await page.selectOption(pageobject.onDeleteSelect, { label: 'Set null' });
    });
    // Click on next button
    await functions.submit();
    // click on edit link
    await page.click(pageobject.EditlinkLocator);
    await page.waitForTimeout(4000);
    await customAssert('Select assignee for every task ', async () => {
      await page.click(pageobject.assignedToTab);
      await page.waitForTimeout(1000);
      await page.click('text=Adam', { force: true });
      await page.locator(pageobject.assignedToTab).nth(1).click();
      await page.click('text=Brandon');
      await page.locator(pageobject.assignedToTab).nth(2).click();
      await page.click('text=Cherry');
    });
  });

  // Create Task List view and add join field
  test('Create Task List view and add join field', async () => {
    await functions.views();
    // click on create new view
    await page.click(pageobject.createnewview);
    // input view name and discription
    await page.fill(pageobject.InputName, 'TaskList');
    await page.fill(pageobject.discriptiontext, 'List of task');

    // validate the view pattern in table dropdown
    await customAssert('View Pattern should be list', async () => {
      // select list pattern
      const ListPattern = await page.$("#inputviewtemplate");
      await ListPattern?.selectOption("List");
    });
    // validate the table name in table dropdown
    await customAssert('Select task table for view', async () => {
      await page.selectOption(pageobject.viewtabledropdown, { label: 'Task' });
    });
    // submit the page
    await functions.submit();
    await page.waitForTimeout(4000);
    await customAssert('Remove assigned and position column', async () => {
      await page.click('text=assigned_to');
      await page.click(pageobject.deletebutton);
      await page.click('text=Position');
      await page.click(pageobject.deletebutton);
    });
    await customAssert('Add join field in new columm', async () => {
      await page.click(pageobject.addcolumnbutton);
      await functions.drag_And_Drop(pageobject.joinField, pageobject.newcolumn);
    });
    await customAssert('Select full name for join field', async () => {
      await page.click(pageobject.fieldsButton);
      await page.click(pageobject.assignedToDropdown);
      await page.click(pageobject.fullNameItem);
    });
    await page.waitForTimeout(5000);
    await page.click(pageobject.nextoption);
    await functions.views();
    await page.click(pageobject.Tasklist);
    await customAssert('full name field should be visible on tasklist', async () => {
      await expect(page.locator(pageobject.fullNameSpan)).toBeVisible();
      await expect(page.getByText('Adam')).toBeVisible();
    });
  });

  // Add view to link show people as assignee
  test('Add view to link show people as assignee', async () => {
    await functions.views();
    await page.click(pageobject.configureTasklist);
    await page.waitForTimeout(4000);
    await customAssert('Add link to view in new columm', async () => {
      await page.click(pageobject.addcolumnbutton);
      await page.waitForTimeout(1000);
      await functions.drag_And_Drop(pageobject.viewlinksource, pageobject.newcolumn);
    });
    await customAssert('view to link dropdown should be visible', async () => {
      await page.click(pageobject.viewtolinkdropdown);
      // Click the view to edit option in the dropdown
      await page.click(pageobject.view2showpeople);
    });
    // click on select button and select assignedto
    await page.click(pageobject.selectButton);
    await page.click(pageobject.assignedToItem);
    // add label for link
    await functions.fill_Text(pageobject.lebelforfield, 'Show Assignee');
    await page.waitForTimeout(5000);
    // click on next button
    await page.click(pageobject.nextoption);
    // Go to task list
    await functions.views();
    await page.click(pageobject.Tasklist);
    // click on assignee link and assert the name
    await customAssert('click on assignee link and assert the name', async () => {
      await page.click(pageobject.showAssigneeLink);
      await expect(page.getByText('Adam').first()).toBeVisible();
    });
  });

  // Create teams table and add data
  test('Create teams table and add data', async () => {
    // click table button
    await functions.click_table();
    // Click the "Create table" button
    await page.click(pageobject.createtablebutton);
    // Enter Table name
    await functions.fill_Text(pageobject.InputName, 'Teams');
    // click on Create button
    await page.click(pageobject.submitButton);
    // click on add field button
    await page.click(pageobject.addFieldButtonLocator);
    // Fill the lable name
    await functions.fill_Text(pageobject.labelTextboxlocator, 'Name');
    // Click on next button
    await functions.submit();
    await functions.submit();
    // click on finish button
    await functions.submit();
    await page.click(pageobject.EditlinkLocator);
    // Click on add row button
    await page.waitForTimeout(3000);
    await page.click(pageobject.addrowlocator);
    // enter value in First row
    await page.click(pageobject.Nametab);
    await page.keyboard.type('Maintenance');
    await page.waitForTimeout(1000);

    await page.click(pageobject.addrowlocator);
    await page.click(pageobject.Nametab);
    await page.keyboard.type('Engineering');
    await page.waitForTimeout(1000);

    await page.click(pageobject.addrowlocator);
    await page.click(pageobject.Nametab);
    await page.keyboard.type('Management');
    await page.waitForTimeout(1000);
  });

  // Add teams field in people table and link to teams table
  test('Add teams field in people table and link to teams table', async () => {
    // click table button
    await functions.click_table();
    await page.click(pageobject.Peopletable);
    await page.click(pageobject.addFieldButtonLocator);
    // Fill the lable name
    await functions.fill_Text(pageobject.labelTextboxlocator, 'Team');
    await customAssert('Select type key to Teams ', async () => {
      const type1 = await page.$("#inputtype");
      await type1?.selectOption("Key to Teams");
    });
    // Click on next button
    await functions.submit();
    await customAssert('Select Name on summary field', async () => {
      await page.selectOption(pageobject.summaryFieldSelect, { label: 'Name [String]' });
    });
    // Click on next button
    await functions.submit();
    await page.click(pageobject.EditlinkLocator);
    await page.waitForTimeout(2000);
    await customAssert('Select Teams on people table', async () => {
      await page.click(pageobject.teamsCell);
      await page.click('text=Maintenance');
      await page.locator(pageobject.teamsCell).nth(1).click();
      await page.click('text=Engineering');
      await page.locator(pageobject.teamsCell).nth(2).click();
      await page.click('text=Management');
      // await page.reload();
    });
  });

  // Add join field in task list for teams
  test('Add join field in task list for teams', async () => {
    await functions.views();
    await page.click(pageobject.configureTasklist);
    await page.waitForTimeout(4000);
    await page.click('text=Column 4');
    await page.click(pageobject.deletebutton);
    await customAssert('Add join field in new columm', async () => {
      await page.click(pageobject.addcolumnbutton);
      await functions.drag_And_Drop(pageobject.joinField, pageobject.newcolumn);
    });
    await customAssert('Select Name from teams for join field', async () => {
      await page.click(pageobject.fieldsButton);
      await page.click(pageobject.assignedToDropdown);
      await page.click(pageobject.teamDropdown);
      const items = await page.$$(pageobject.nameItem);
      for (const item of items) {
        const text = await item.evaluate(el => el.textContent.trim());
        if (text === 'name') {
          await item.click();
          break;
        }
      }
    });
    await page.waitForTimeout(5000);
    await page.click(pageobject.nextoption);
    await functions.views();
    await page.click(pageobject.Tasklist);
    await customAssert('name field from teams should be visible on tasklist', async () => {
      // await expect(page.locator(pageobject.nameSpan)).toBeVisible();
      await expect(page.getByText('Maintenance')).toBeVisible();
    });
  });

  // Add join field for date of birth in task list for teams
  test('Add join field for date of birth in task list for teams', async () => {
    await functions.views();
    await page.click(pageobject.configureTasklist);
    await page.waitForTimeout(4000);
    await page.click(pageobject.TeamNameSpan);
    await customAssert('Select full name for join field', async () => {
      await page.click(pageobject.fieldsButton);
      await page.click(pageobject.assignedToDropdown);
      await page.click(pageobject.DobItem);
    });
    await customAssert('Select format from the dropdown', async () => {
      // Select 'format' from the dropdown
      await page.selectOption(pageobject.fieldViewdropdown, { label: 'format' }); // using field view dropdown
    });
    await page.waitForTimeout(5000);
    await page.click(pageobject.nextoption);
    await functions.views();
    await page.click(pageobject.Tasklist);
    await customAssert('Date of birth field from people should be visible on tasklist', async () => {
      await expect(page.locator(pageobject.dateOfBirthSpan)).toBeVisible();
    });
  });
});