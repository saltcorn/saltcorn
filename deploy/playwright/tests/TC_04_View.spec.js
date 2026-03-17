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
  let listViewName;
  let editViewName;
  let showViewName;

  test.beforeAll(async ({ browser }) => {
    randomString = PageFunctions.generate_Random_String(10);
    listViewName = 'NewView_List_' + randomString;
    editViewName = 'View2_Edit_' + randomString;
    showViewName = 'showView_' + randomString;
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
    await page.fill(pageobject.InputName, listViewName);
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
    await page.waitForTimeout(2000);
    // click on add column button on page
    await page.waitForSelector(pageobject.addcolumnbutton);
    await page.click(pageobject.addcolumnbutton);
    // drag and drop the action locator
    await page.waitForSelector(pageobject.ActionLocator);
    await functions.drag_And_Drop(pageobject.ActionLocator, pageobject.newcolumn);
    // click on next button
    await page.waitForSelector(pageobject.nextoption);
    await page.click(pageobject.nextoption);
    // click on next button
    await functions.submit();
    await functions.submit();

    // click on new view link
    await page.waitForSelector(`a[href^="/view/NewView_List"]`);
    await page.click(`a[href^="/view/NewView_List"]`);
  });

  // create new view with edit view pattern
  test('create new view with edit view pattern', async () => {
    await functions.views();
    // click on create new view
    await page.waitForSelector(pageobject.createnewview);
    await page.click(pageobject.createnewview);
    // input view name and discription
    await page.fill(pageobject.InputName, editViewName);
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
    await page.waitForTimeout(2000);
    // select inputbox and delete
    await page.waitForSelector(pageobject.inputDateOfBirth);
    await page.click(pageobject.inputDateOfBirth);
    await page.waitForSelector(pageobject.deletebutton);
    await page.click(pageobject.deletebutton);
    // add new input box in page
    await page.waitForSelector(pageobject.fieldsource);
    await page.click(pageobject.fieldsource);
    await functions.drag_And_Drop(pageobject.fieldsource, pageobject.secondrowcolumn);
    // click on field dropdown for field
    await customAssert('field dropdown should be visible', async () => {
      await page.waitForSelector(pageobject.fielddropdown);
      await expect(page.locator(pageobject.fielddropdown)).toBeVisible();
      await page.click(pageobject.fielddropdown);
      // Select 'Date of birth' from the dropdown
      await page.selectOption('select.form-control.form-select', 'date_of_birth');
    });
    await page.waitForTimeout(2000);
    await functions.drag_And_Drop(pageobject.textSource, pageobject.target);
    await functions.fill_Text(pageobject.richTextEditor, 'I said..');
    // click on delete button
    await page.waitForSelector(pageobject.deletebutton);
    await page.click(pageobject.deletebutton);
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
    test.setTimeout(90000);
    await functions.views();
    await page.waitForLoadState('domcontentloaded');
    // Ensure prerequisite views exist (for running test in isolation)
    let viewExists = false;
    try {
      await page.waitForSelector(`a[href^="/view/NewView_List"]`, { timeout: 5000 });
      viewExists = true;
    } catch { /* view not found */ }
    if (!viewExists) {
      // Create list view
      await page.waitForSelector(pageobject.createnewview);
      await page.click(pageobject.createnewview);
      await page.fill(pageobject.InputName, listViewName);
      await page.fill(pageobject.discriptiontext, 'view for table');
      const ListPattern = await page.$("#inputviewtemplate");
      await ListPattern?.selectOption("List");
      await functions.submit();
      await page.waitForTimeout(2000);
      await page.waitForSelector(pageobject.addcolumnbutton);
      await page.click(pageobject.addcolumnbutton);
      await page.waitForSelector(pageobject.ActionLocator);
      await functions.drag_And_Drop(pageobject.ActionLocator, pageobject.newcolumn);
      await page.waitForSelector(pageobject.nextoption);
      await page.click(pageobject.nextoption);
      await functions.submit();
      await functions.submit();
      // Create edit view
      await functions.views();
      await page.waitForSelector(pageobject.createnewview);
      await page.click(pageobject.createnewview);
      await page.fill(pageobject.InputName, editViewName);
      await page.fill(pageobject.discriptiontext, 'view for table');
      const EditPattern = await page.$("#inputviewtemplate");
      await EditPattern?.selectOption("Edit");
      await functions.submit();
      await page.waitForTimeout(2000);
      await page.waitForSelector(pageobject.inputDateOfBirth);
      await page.click(pageobject.inputDateOfBirth);
      await page.waitForSelector(pageobject.deletebutton);
      await page.click(pageobject.deletebutton);
      await page.waitForSelector(pageobject.fieldsource);
      await page.click(pageobject.fieldsource);
      await functions.drag_And_Drop(pageobject.fieldsource, pageobject.secondrowcolumn);
      await page.waitForSelector(pageobject.fielddropdown);
      await page.click(pageobject.fielddropdown);
      await page.selectOption('select.form-control.form-select', 'date_of_birth');
      await page.waitForTimeout(2000);
      await functions.drag_And_Drop(pageobject.textSource, pageobject.target);
      await functions.fill_Text(pageobject.richTextEditor, 'I said..');
      await page.waitForSelector(pageobject.deletebutton);
      await page.click(pageobject.deletebutton);
      await page.waitForSelector(pageobject.saveactionbutton);
      await page.click(pageobject.saveactionbutton);
      await functions.drag_And_Drop(pageobject.ActionLocator, pageobject.target);
      await page.waitForSelector(pageobject.deletebutton);
      await page.click(pageobject.deletebutton);
      await page.waitForSelector(pageobject.nextoption);
      await page.click(pageobject.nextoption);
      await functions.submit();
      await functions.views();
      await page.waitForTimeout(2000);
    }
    // click on newly created view link
    await page.waitForSelector(`a[href^="/view/NewView_List"]`, { timeout: 15000 });
    await page.click(`a[href^="/view/NewView_List"]`);
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
    await functions.drag_And_Drop(pageobject.viewlinksource, pageobject.newcolumn);
    // click to view link dropdown
    await customAssert('view to link dropdown should be visible', async () => {
      await page.waitForSelector(pageobject.viewtolinkdropdown);
      await expect(page.locator(pageobject.viewtolinkdropdown)).toBeVisible();
      await page.click(pageobject.viewtolinkdropdown);
      // Click the view to edit option in the dropdown
      await page.click(`text=/View2_Edit.*\\[Edit\\].*My_Table/`);
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
    await page.waitForSelector(`a[href^="/view/NewView_List"]`);
    await page.click(`a[href^="/view/NewView_List"]`);
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
    await page.waitForSelector(`a[href^="/view/NewView_List"]`);
    await page.click(`a[href^="/view/NewView_List"]`);
    // click on edit link
    await page.waitForSelector(pageobject.editviewlink);
    await page.click(pageobject.editviewlink);
    // submit the page
    await functions.submit();
    // click on next page
    await page.waitForSelector(pageobject.nextoption);
    await page.click(pageobject.nextoption);
    // select view to create from dropdown (match View2_Edit prefix)
    await page.waitForSelector(pageobject.viewtocreate);
    const optionValue = await page.evaluate(() => {
      const select = document.querySelector('#inputview_to_create');
      const opt = Array.from(select?.options || []).find(o => o.text.includes('View2_Edit') && o.text.includes('[Edit]'));
      return opt ? opt.value : null;
    });
    await page.selectOption('#inputview_to_create', optionValue);
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
    await page.waitForSelector(`a[href^="/view/NewView_List"]`);
    await page.click(`a[href^="/view/NewView_List"]`);
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
    await page.waitForSelector(pageobject.saveactionbutton);
    await page.click(pageobject.saveactionbutton);
    // go to view again and click to see new view link
    await functions.views();
    await page.waitForSelector(`a[href^="/view/NewView_List"]`);
    await page.click(`a[href^="/view/NewView_List"]`);
  });

  // create view with show view pattern
  test('Create view with show view pattern', async () => {
    test.setTimeout(90000);
    await functions.views();
    // click on create new view
    await page.click(pageobject.createnewview);
    // input view name and discription
    await page.fill(pageobject.InputName, showViewName);
    await page.fill(pageobject.discriptiontext, 'view for table');
    await page.selectOption(pageobject.viewtabledropdown, { label: 'My_Table' });
    // select show pattern
    await customAssert('Select show view pattern for view', async () => {
      const ShowPattern = await page.$("#inputviewtemplate");
      await ShowPattern?.selectOption("Show");
    });
    // submit the page
    await functions.submit();
    await page.waitForLoadState('load');
    await page.waitForSelector(pageobject.Fullnameshow, { state: 'visible', timeout: 15000 });
    // select full name lable
    await page.click(pageobject.Fullnameshow);
    // delete lable for full name
    await page.click(pageobject.deletebutton);
    await customAssert('Drag Name on top of the page set heading', async () => {
      await functions.drag_And_Drop(pageobject.fullnameuser, pageobject.addresslabel);
      // select text style as Heading 1 for full name
      await page.click("button.style-h1");
    });
    await page.waitForTimeout(4000);
    await customAssert('Drag address row on third column', async () => {
      await functions.drag_And_Drop(pageobject.Addresstext, pageobject.thirdrowcolumn2);
    });
    await functions.drag_And_Drop(pageobject.addresslabel, pageobject.thirdrowcolumn1);
    await page.click(pageobject.firstrowcolumn1);
    await page.waitForTimeout(2000);
    // Set column width to 4 if width input is visible (optional - UI may vary)
    try {
      await page.waitForSelector('input[name="cols_xl"], input.form-control[type="number"]', { state: 'visible', timeout: 5000 });
      await page.locator('input[name="cols_xl"], input.form-control[type="number"]').first.fill('4');
    } catch {
      // Width input not found, proceed (default may be acceptable)
    }
    // click on next button
    await page.click(pageobject.nextoption);
  });

  // add show link in list view
  test('Add show link in list view by by connecting show view', async () => {
    await functions.views();
    await page.waitForSelector(`a[href^="/view/NewView_List"]`);
    await page.click(`a[href^="/view/NewView_List"]`);
    await page.waitForSelector(pageobject.editviewlink);
    await page.click(pageobject.editviewlink);
    // submit the page
    await functions.submit();
    // click on add column button on page
    await page.waitForSelector(pageobject.addcolumnbutton);
    await page.click(pageobject.addcolumnbutton);
    // drag and drop the viewlink locator
    await functions.drag_And_Drop(pageobject.viewlinksource, pageobject.newcolumn);
    // select view to show from dropdown
    await customAssert('view to show dropdown should be visible', async () => {
      await page.waitForSelector(pageobject.viewtolinkdropdown);
      await expect(page.locator(pageobject.viewtolinkdropdown)).toBeVisible();
      await page.click(pageobject.viewtolinkdropdown);
      // Click the view to show option in the dropdown
      await page.click(`text=/showView.*\\[Show\\].*My_Table/`);
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
    await page.waitForSelector(`a[href^="/view/NewView_List"]`);
    await page.click(`a[href^="/view/NewView_List"]`);
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

  // Change Date Field view as showDay in Form
  test('Edit Date Field view as showDay in Form', async () => {
    await functions.views();
    await page.click(`a[href^="/view/NewView_List"]`);
    await page.waitForSelector(pageobject.editviewlink);
    await page.click(pageobject.editviewlink);
    // submit the page
    await functions.submit();
    await page.waitForTimeout(2000);
    await page.click(pageobject.DateTimeUser);
    await customAssert('field view dropdown should be visible', async () => {
      await page.waitForSelector(pageobject.fieldViewdropdown);
      await expect(page.locator(pageobject.fieldViewdropdown)).toBeVisible();
      // Select 'showDay' from the dropdown
      await page.selectOption(pageobject.fieldViewdropdown, { label: 'showDay' }); // If using a select dropdown
    });
    await page.waitForSelector(pageobject.nextoption);
    await page.click(pageobject.nextoption);
    // click on finish button
    await functions.submit();
    await page.click(`a[href^="/view/NewView_List"]`);
    await customAssert('Date format should be DD/MM/YYYY and not showing time', async () => {
      // Assert the date is in DD/MM/YYYY format using a regex
      await expect(page.locator(pageobject.localDateOption)).toHaveText(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
    });
  });

  // Change Date Field view as relative in Form
  test('Edit Date Field view as relative in Form', async () => {
    await functions.views();
    await page.click(`a[href^="/view/NewView_List"]`);
    await page.waitForSelector(pageobject.editviewlink);
    await page.click(pageobject.editviewlink);
    // submit the page
    await functions.submit();
    await page.waitForTimeout(2000);
    await page.click(pageobject.localDateOption);
    await customAssert('field view dropdown should be visible', async () => {
      await page.waitForSelector(pageobject.fieldViewdropdown);
      await expect(page.locator(pageobject.fieldViewdropdown)).toBeVisible();
      // Select 'relative' from the dropdown
      await page.selectOption(pageobject.fieldViewdropdown, { label: 'relative' }); // If using a select dropdown
    });
    await page.waitForSelector(pageobject.nextoption);
    await page.click(pageobject.nextoption);
    // click on finish button
    await functions.submit();
    await page.click(`a[href^="/view/NewView_List"]`);
    await customAssert('The table cell should contain text in the format "X years ago"', async () => {
      // Assert that the row contains the text "years ago"
      await expect(page.locator(pageobject.DateYearsAgo)).toContainText('years ago');
    });
  });

  // Change Date Field view as Format in Form
  test('Edit Date Field view as Format in Form', async () => {
    await functions.views();
    await page.click(`a[href^="/view/NewView_List"]`);
    await page.waitForSelector(pageobject.editviewlink);
    await page.click(pageobject.editviewlink);
    // submit the page
    await functions.submit();
    await page.waitForTimeout(2000);
    await page.click(pageobject.divYearAgo);
    await customAssert('field view dropdown should be visible', async () => {
      await page.waitForSelector(pageobject.fieldViewdropdown);
      await expect(page.locator(pageobject.fieldViewdropdown)).toBeVisible();
      // Select 'format' from the dropdown
      await page.selectOption(pageobject.fieldViewdropdown, { label: 'format' }); // If using a select dropdown
    });
    await page.fill(pageobject.inputFormat, 'YYYY-MM-DD');
    await page.waitForSelector(pageobject.nextoption);
    await page.click(pageobject.nextoption);
    // click on finish button
    await functions.submit();
    await page.click(`a[href^="/view/NewView_List"]`);
    await customAssert('The Date Format should be in the format "YYYY-MM-DD"', async () => {
      // Assert that the Date format should be YYYY-MM-DD
      await expect(page.locator(pageobject.LocalDateFormat)).toHaveText(/^\d{4}-\d{2}-\d{2}$/); // Regular expression for YYYY-MM-DD format
    });
  });

  // Add Flatepicker in Date Field view in Form
  test('Add Flatepicker in Date Field view in Form', async () => {
    await functions.install_flatpickr();
    await functions.views();
    await page.click(`a[href^="/view/View2_Edit"]`);
    await page.click(pageobject.editviewlink);
    await functions.submit();
    await page.waitForTimeout(4000);
    await page.click(pageobject.DatelocatorByName);
    await customAssert('Select Flatpickr in field view dropdown', async () => {
      await page.waitForSelector(pageobject.fieldViewdropdown);
      // Select 'flatepickr' from the dropdown
      await page.selectOption(pageobject.fieldViewdropdown, { label: 'flatpickr' }); // If using a select dropdown
    });
    await page.waitForTimeout(5000);
    await page.click(pageobject.nextoption);
    await functions.views();
    await page.click(`a[href^="/view/View2_Edit"]`);
    await page.click(pageobject.DatepickReadonly);
    // Check if the calendar is visible
    await customAssert('Calander should be open after clicking on date column ', async () => {
      const calendarVisible = await page.isVisible(pageobject.calendarlocator);
      expect(calendarVisible).toBe(true);
    });
  });

  // Add Bio field with ckeditor module in Form
  test('Add Bio field with ckeditor module in Form', async () => {
    test.setTimeout(90000);
    await functions.install_ckeditor();
    // click table button
    await functions.click_table();
    // Go to my table
    await page.waitForSelector(pageobject.mytable);
    await page.click(pageobject.mytable);
    // Add Bio field only if it does not already exist
    const bioExists = (await page.locator(pageobject.biofieldlocator).count()) > 0;
    if (!bioExists) {
      // click on add field button
      await page.waitForSelector(pageobject.addFieldButtonLocator);
      await page.click(pageobject.addFieldButtonLocator);
      // Fill the lable name
      await functions.fill_Text(pageobject.labelTextboxlocator, '');
      await functions.fill_Text(pageobject.labelTextboxlocator, 'Bio');
      // select the input type
      const type = await page.$("#inputtype");
      await type?.selectOption("HTML");
      // Fill the discription
      await functions.fill_Text(pageobject.descriptionSelector, 'Bio of User');
      // Click on next button
      await functions.submit();
      // click on next button again
      await functions.submit();
    }
    // Go to views
    await functions.views();
    // Configure the Edit view
    await page.waitForSelector(`a[href^="/viewedit/config/View2_Edit"]`);
    await page.click(`a[href^="/viewedit/config/View2_Edit"]`);
    // add new column on page
    await functions.drag_And_Drop(pageobject.columnsElement, pageobject.target);
    await page.waitForTimeout(1000);
    // Add text and field in col-sm-6 columns (from Split into columns)
    await functions.drag_And_Drop(pageobject.textSource, pageobject.builderColSm6First);
    await functions.drag_And_Drop(pageobject.fieldsource, pageobject.builderColSm6Second);
    await customAssert('Select Bio from field dropdown', async () => {
      await page.waitForSelector(pageobject.fielddropdown);
      await page.selectOption(pageobject.fielddropdown, { label: 'Bio' });
    });
    await customAssert('Select ckeditor4 from field view dropdown', async () => {
      await page.waitForSelector(pageobject.fieldViewdropdown);
      // Select 'CKEditor4' from the dropdown
      await page.waitForTimeout(2000);
      await page.selectOption(pageobject.fieldViewdropdown, { label: 'CKEditor4' }); // If using a select dropdown
    });
    await customAssert('Select Reduced from Toolbar dropdown', async () => {
      await page.waitForSelector(pageobject.Toolbardropdown);
      await page.click(pageobject.Toolbardropdown);
      // Select 'Reduced' from the dropdown
      await page.waitForTimeout(2000);
      await page.selectOption(pageobject.Toolbardropdown, { label: 'Reduced' }); // If using a select dropdown
    });
    await page.click(pageobject.helloWorldElement);
    await functions.clearText(pageobject.richTextEditor);
    await page.keyboard.type('Bio');
    await page.selectOption(pageobject.optionBio, { label: 'Bio' });
    await page.waitForTimeout(3000);
    await page.click(pageobject.nextoption);
    await functions.views();
    await page.click(`a[href^="/view/NewView_List"]`);
    await page.click(pageobject.editfieldlink);
    await page.waitForSelector('iframe');
    await customAssert('Input bio in iframe/html textbox', async () => {
      // Wait for the iframe to be available
      // await page.waitForSelector('iframe');
      const frame = page.frameLocator('iframe');
      // Wait for the body inside the iframe to be available
      await frame.locator('body').waitFor();
      // Optionally, ensure the body is visible before filling it
      await frame.locator('body').waitFor({ state: 'visible' });
      // Fill the content inside the iframe
      await frame.locator('body').click(); // Ensure the body is focused
      await frame.locator('body').type('Rebecca is very sporty\n- Football\n- Tennis');
    });
    await functions.submit();
  });

  // Add Bio field and edit link button in show view
  test('Add Bio field in show view', async () => {
    test.setTimeout(90000);
    await functions.views();
    await page.waitForSelector(`a[href^="/viewedit/config/showView"]`);
    await page.click(`a[href^="/viewedit/config/showView"]`);
    // add new column on page
    await functions.drag_And_Drop(pageobject.columnsElement, pageobject.target);
    await page.waitForTimeout(1000);
    // Add text and field in col-sm-6 columns (from Split into columns)
    await functions.drag_And_Drop(pageobject.textSource, pageobject.builderColSm6First);
    await functions.drag_And_Drop(pageobject.fieldsource, pageobject.builderColSm6Second);
    await customAssert('Select Bio from field dropdown', async () => {
      await page.waitForSelector(pageobject.fielddropdown);
      await page.selectOption(pageobject.fielddropdown, { label: 'Bio' });
    });
    await customAssert('Select showAll from field view dropdown', async () => {
      await page.waitForSelector(pageobject.fieldViewdropdown);
      // Select 'showAll' from the dropdown
      await page.selectOption(pageobject.fieldViewdropdown, { label: 'showAll' }); // If using a select dropdown
    });
    await page.click(pageobject.helloWorldElement);
    await functions.clearText(pageobject.richTextEditor);
    await page.keyboard.type('Bio');
    await page.waitForTimeout(2000);

    // drag and drop the action view link
    await page.waitForSelector(pageobject.viewlinksource);
    await functions.drag_And_Drop(pageobject.viewlinksource, pageobject.target);
    // click to view link dropdown
    await customAssert('view to link dropdown should be visible', async () => {
      await page.waitForSelector(pageobject.viewtolinkdropdown);
      await expect(page.locator(pageobject.viewtolinkdropdown)).toBeVisible();
      await page.click(pageobject.viewtolinkdropdown);
      // Click the view to edit option in the dropdown
      await page.click(`text=/View2_Edit.*\\[Edit\\].*My_Table/`);
    });
    // add lable for link
    await functions.fill_Text(pageobject.lebelforfield, 'Edit');
    await page.waitForSelector(pageobject.viewtolinkdropdown);
    await page.click(pageobject.viewtolinkdropdown);
    // Action Style dropdown should be visible 
    await customAssert('Select Primary button in View link style dropdown', async () => {
      const styleDropdown = page.locator('.form-control.form-select').nth(0);
      // Open the dropdown and select the "Primary button" option
      await styleDropdown.selectOption({ label: 'Primary button' });
    });
    await page.click(pageobject.angleDownIconLocator);
    await functions.fill_Text(pageobject.searchIconLocator, 'Edit');
    await page.click(pageobject.editIconLocator);

    await page.waitForTimeout(2000);
    await page.click(pageobject.nextoption);
    await functions.views();
    await page.click(`a[href^="/view/NewView_List"]`);
    await page.click(pageobject.showfieldlink);
    await page.click(pageobject.showeditLink);
  });
});