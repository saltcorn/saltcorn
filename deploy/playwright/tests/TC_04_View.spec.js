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

  // create view with list view pattern
  test('create view with list view pattern', async () => {
    await functions.views();
    // assert the view edit url
    await customAssert('page url should be /viewedit  ', async () => {
      expect(page.url()).toBe(baseURL + derivedURL + 'viewedit');
    });
    // assert the visibility of create new view
    await customAssert('Create new view button should be visible and working', async () => {
      await page.waitForSelector(pageobject.createnewview);
      await expect(page.locator(pageobject.createnewview)).toBeVisible();
      // Assert the lable for create view button
      await expect(page.locator(pageobject.createnewview)).toHaveText('Create view');
      // click on create new view
      await page.click(pageobject.createnewview);
    });
    // assert the view url
    await customAssert('page url should be /viewedit/new  ', async () => {
      expect(page.url()).toBe(baseURL + derivedURL + 'viewedit/new');
    });
    // input view name and discription
    await page.fill(pageobject.InputName, 'NewView_List');
    await page.fill(pageobject.discriptiontext, 'view for table');

    // validate the view pattern in table dropdown
    await customAssert('View Pattern should be list', async () => {
      // select list pattern
      const ListPattern = await page.$("#inputviewtemplate");
      await ListPattern?.selectOption("List");
    });

    // validate the table name in table dropdown
    await customAssert('Table Name should be same as we created earlier', async () => {
      await expect(page.locator('#inputtable_name')).toHaveText(`My_Tableusers`);
      const tableText = await page.locator('#inputtable_name').innerText();
      await page.locator('#inputtable_name').selectText('My_Table');
      console.log(`Text in locator '#inputtable_name': ${tableText}`);
    });
    // submit the page
    await functions.submit();
    await page.waitForTimeout(5000);
    // click on add column button on page
    await page.waitForSelector(pageobject.addcolumnbutton);
    await page.click(pageobject.addcolumnbutton);
    // drag and drop the action locator
    await page.waitForSelector(pageobject.ActionLocator);
    await functions.drag_And_Drop(pageobject.ActionLocator, pageobject.newcolumn1);
    // click on next button
    await page.waitForSelector(pageobject.nextoption);
    await page.click(pageobject.nextoption);
    // click on next button
    await functions.submit();
    await functions.submit();

    // click on new view link
    await page.waitForSelector(pageobject.newviewlink);
    await page.click(pageobject.newviewlink);
  });

  // create new view with edit view pattern
  test('create new view with edit view pattern', async () => {
    await functions.views();
    // click on create new view
    await page.waitForSelector(pageobject.createnewview);
    await page.click(pageobject.createnewview);
    // input view name and discription
    await page.fill(pageobject.InputName, 'View2_Edit');
    await page.fill(pageobject.discriptiontext, 'view for table');
    // validate the view pattern in table dropdown
    await customAssert('View Pattern should be Edit', async () => {
      // select the Edit pattern
      const EditPattern = await page.$("#inputviewtemplate");
      await EditPattern?.selectOption("Edit");
    });
    // submit the page
    await functions.submit();
    // drag and drop the page source on the page
    await page.waitForTimeout(5000);
    await functions.drag_And_Drop(pageobject.textSource, pageobject.target);
    await functions.fill_Text(pageobject.textlocator, 'I said..');
    // click on delete button
    await page.waitForSelector(pageobject.deletebutton);
    await page.click(pageobject.deletebutton);
    // select inputbox and delete
    await page.waitForSelector(pageobject.inputbox2);
    await page.click(pageobject.inputbox2);
    await page.waitForSelector(pageobject.deletebutton);
    await page.click(pageobject.deletebutton);
    // add new input box in page
    await page.waitForSelector(pageobject.fieldsourrce);
    await page.click(pageobject.fieldsourrce);
    await functions.drag_And_Drop(pageobject.fieldsourrce, pageobject.target);
    // click on field dropdown for field

    await customAssert('field dropdown should be visible', async () => {
      await page.waitForSelector(pageobject.fielddropdown);
      await expect(page.locator(pageobject.fielddropdown)).toBeVisible();
      await page.click(pageobject.fielddropdown);
      // Select 'Date of birth' from the dropdown
      await page.selectOption('select.form-control.form-select', 'date_of_birth');
    });

    // click on save button
    await page.waitForSelector(pageobject.saveactionbutton);
    await page.click(pageobject.saveactionbutton);
    // add new action button on page
    await functions.drag_And_Drop(pageobject.ActionLocator, pageobject.target);
    // delete the button
    await page.waitForSelector(pageobject.deletebutton);
    await page.click(pageobject.deletebutton);
    // click on next page
    await page.waitForSelector(pageobject.nextoption);
    await page.click(pageobject.nextoption);
    // click on finish button
    await functions.submit();
  });

  // Add edit link in list view
  test('Add edit link in list view', async () => {
    // visit view 
    await functions.views();
    // click on newly created view link
    await page.waitForSelector(pageobject.newviewlink);
    await page.click(pageobject.newviewlink);
    // click on edit link
    await page.waitForSelector(pageobject.editviewlink);
    await page.click(pageobject.editviewlink);
    // submit the page
    await functions.submit();
    // click on add column button on page
    await page.waitForSelector(pageobject.addcolumnbutton);
    await page.click(pageobject.addcolumnbutton);
    // drag and drop the action view link
    await page.waitForSelector(pageobject.viewlinksource);
    await functions.drag_And_Drop(pageobject.viewlinksource, pageobject.newcolumn2);
    // click to view link dropdown
    await customAssert('view to link dropdown should be visible', async () => {
      await page.waitForSelector(pageobject.viewtolinkdropdown);
      await expect(page.locator(pageobject.viewtolinkdropdown)).toBeVisible();
      await page.click(pageobject.viewtolinkdropdown);
      // Click the view to edit option in the dropdown
      await page.click(pageobject.view2editoption);
    });
    // add lable for link
    await functions.fill_Text(pageobject.lebelforfield, 'Edit');
    await page.waitForSelector(pageobject.viewtolinkdropdown);
    await page.click(pageobject.viewtolinkdropdown);
    // click next button
    await page.waitForSelector(pageobject.nextoption);
    await page.click(pageobject.nextoption);
    // click next button again
    await functions.submit();
    // submit the page
    await functions.submit();
    // click finish button
    await functions.submit();
    // click to new view link again
    await page.waitForSelector(pageobject.newviewlink);
    await page.click(pageobject.newviewlink);
    // check visibility for edit butoon for row
    await customAssert('Edit field link should be visible', async () => {
      await expect(page.locator(pageobject.editfieldlink)).toBeVisible();
      // assert the lable for edit link
      await expect(page.locator(pageobject.editfieldlink)).toHaveText('Edit');
      // click on edit button
      await page.waitForSelector(pageobject.editfieldlink);
      await page.click(pageobject.editfieldlink);
    });
  });

  // Add link to create new row in table
  test('Add link to create new row in table', async () => {
    // visit view
    await functions.views();
    // click on new view link
    await page.waitForSelector(pageobject.newviewlink);
    await page.click(pageobject.newviewlink);
    // click on edit link
    await page.waitForSelector(pageobject.editviewlink);
    await page.click(pageobject.editviewlink);
    // submit the page
    await functions.submit();
    // click on next page
    await page.waitForSelector(pageobject.nextoption);
    await page.click(pageobject.nextoption);
    // seslet view to create from dropdown
    await page.waitForSelector(pageobject.viewtocreate);
    await page.click(pageobject.viewtocreate);
    const viewtocreate = await page.$("#inputview_to_create");
    await viewtocreate?.selectOption("View2_Edit [Edit]");
    // add lable for view to create
    await functions.fill_Text(pageobject.labeltocreate, 'Add person');
    // click on next button
    await functions.submit();
    // click on next button again
    await functions.submit();
    // click on finish button
    await page.waitForSelector(pageobject.finishbuttonprimary);
    await page.click(pageobject.finishbuttonprimary);
    // click on new view link
    await page.waitForSelector(pageobject.newviewlink);
    await page.click(pageobject.newviewlink);
    // assert the visibility of add person link
    await customAssert('Add person link should be visible and working', async () => {
      await expect(page.locator(pageobject.addpersonlink)).toBeVisible();
      // assert the lable for add person link
      await expect(page.locator(pageobject.addpersonlink)).toHaveText('Add person');
      // click on add person link
      await page.waitForSelector(pageobject.addpersonlink);
      await page.click(pageobject.addpersonlink);
    });
    // click on save button
    await page.waitForSelector(pageobject.saveprimarybutton);
    await page.click(pageobject.saveprimarybutton);
    // go to view again and click to see new view link
    await functions.views();
    await page.waitForSelector(pageobject.newviewlink);
    await page.click(pageobject.newviewlink);
  });

  // create view with show view pattern
  test('create view with show view pattern', async () => {
    await functions.views();
    // click on create new view
    await page.waitForSelector(pageobject.createnewview);
    await page.click(pageobject.createnewview);
    // input view name and discription
    await page.fill(pageobject.InputName, 'showView');
    await page.fill(pageobject.discriptiontext, 'view for table');
    // validate the view pattern in table dropdown
    await customAssert('View Pattern should be Show', async () => {
      // select show pattern
      const ShowPattern = await page.$("#inputviewtemplate");
      await ShowPattern?.selectOption("Show");
    });
    // submit the page
    await functions.submit();
    await page.waitForTimeout(5000);
    // select full name lable
    await page.waitForSelector(pageobject.Fullnameshow);
    await page.click(pageobject.Fullnameshow);
    // delete lable for full name
    await page.waitForSelector(pageobject.deletebutton);
    await page.click(pageobject.deletebutton);
    // drag full name on target
    await functions.drag_And_Drop(pageobject.fullnameuser, pageobject.target);
    // select text style as heading1 for full name
    const textstyleLocator = page.locator('.form-control.form-select').nth(2);
    await textstyleLocator.click();
    await textstyleLocator?.selectOption("Heading 1");
    // click on next button
    await page.waitForSelector(pageobject.nextoption);
    await page.click(pageobject.nextoption);
    // click on new view link
    await page.waitForSelector(pageobject.newviewlink);
    await page.click(pageobject.newviewlink);
  });

  // add show link in list view
  test('Add show link in list view by by connecting show view', async () => {
    await functions.views();
    await page.click(pageobject.newviewlink);
    await page.waitForSelector(pageobject.editviewlink);
    await page.click(pageobject.editviewlink);
    // submit the page
    await functions.submit();
    // click on add column button on page
    await page.waitForSelector(pageobject.addcolumnbutton);
    await page.click(pageobject.addcolumnbutton);
    // drag and drop the viewlink locator
    await functions.drag_And_Drop(pageobject.viewlinksource, pageobject.newcolumn3);
    // select view to show from dropdown
    await customAssert('view to show dropdown should be visible', async () => {
      await page.waitForSelector(pageobject.viewtolinkdropdown);
      await expect(page.locator(pageobject.viewtolinkdropdown)).toBeVisible();
      await page.click(pageobject.viewtolinkdropdown);
      // Click the view to edit option in the dropdown
      await page.click(pageobject.view2showoption);
    });

    // add lable for link
    await page.waitForSelector(pageobject.lebelforfield);
    await functions.fill_Text(pageobject.lebelforfield, 'Show');
    // click on next button
    await page.waitForSelector(pageobject.nextoption);
    await page.click(pageobject.nextoption);
    // click next button again
    await functions.submit();
    //submit the page
    await functions.submit();
    // click finish button
    await page.waitForSelector(pageobject.finishbuttonprimary);
    await page.click(pageobject.finishbuttonprimary);
    // click to new view link again
    await page.waitForSelector(pageobject.newviewlink);
    await page.click(pageobject.newviewlink);
    // check that show link is visible and working
    await customAssert('Assert show link is visible and working', async () => {
      await page.waitForSelector(pageobject.showfieldlink);
      await expect(page.locator(pageobject.showfieldlink)).toBeVisible();
      // assert the lable for show link
      await expect(page.locator(pageobject.showfieldlink)).toHaveText('Show');
      // Click on show link
      await page.click(pageobject.showfieldlink);
    });
  });
});