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
  let randomString;

  test.beforeAll(async ({ browser }) => {
    // Initialize the log file
    Logger.initialize();
    // Create a new context and page for all tests
    context = await browser.newContext();
    page = await context.newPage();

    // Maximize the screen
    await page.setViewportSize({ width: 1350, height: 720 });

    functions = new PageFunctions(page);
    pageobject = new PageObject(page);

    // Generate a random string for all tests
    randomString = PageFunctions.generate_Random_String(5);

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

  test('Click table button and verify URL', async () => {
    // Clear data before test executions
    await functions.clear_Data();
    // click table button
    await functions.click_table();
    await customAssert('Page url should be /table ', async () => {
      expect(page.url()).toBe(baseURL + derivedURL + 'table');
    });
  });

  // Check the "Create table" function
  test('Check the "Create table" Function', async () => {
    // click table button
    await functions.click_table();
    await customAssert('Create table button should be visible and working', async () => {
      await page.waitForSelector(pageobject.createtablebutton);
      await expect(page.locator(pageobject.createtablebutton)).toBeVisible();
      // Assert label of Create table button
      await expect(page.locator(pageobject.createtablebutton)).toHaveText('Create table');
      // Click the "Create table" button
      await page.click(pageobject.createtablebutton);
    });
    // Enter Table name
    await functions.fill_Text(pageobject.InputName, 'My_Table');
    await customAssert('Create button should be visible and working', async () => {
      await page.waitForSelector(pageobject.submitButton);
      await expect(page.locator(pageobject.submitButton)).toBeVisible();
      // Assert label of create button
      await expect(page.locator(pageobject.submitButton)).toHaveText('Create');
      // click on Create button
      await page.click(pageobject.submitButton);
    });
    // check visibility of id field already exist
    await customAssert('Id field for table should be already exist ', async () => {
      await page.waitForSelector(pageobject.idfieldlocator);
      await expect(page.locator(pageobject.idfieldlocator)).toBeVisible();
      // Assert the lable of ID field
      await expect(page.locator(pageobject.idfieldlocator)).toHaveText('ID');
    });
    // check id field is iteger type
    await customAssert('Id field should be integer type ', async () => {
      await page.waitForSelector(pageobject.idtypelocator);
      await expect(page.locator(pageobject.idtypelocator)).toBeVisible();
      // Assert the label of variable type of id
      await expect(page.locator(pageobject.idtypelocator)).toHaveText('Integer');
    });
  });

  // Add Full name field in the table
  test('Add Full name field in the table', async () => {
    // click table button
    await functions.click_table();
    // Go to my table
    await page.waitForSelector(pageobject.mytable);
    await page.click(pageobject.mytable);
    // click on add field button
    await page.waitForSelector(pageobject.addFieldButtonLocator);
    await page.click(pageobject.addFieldButtonLocator);
    // Fill the lable name
    await functions.fill_Text(pageobject.labelTextboxlocator, 'Full name');
    // select the input type
    const type = await page.$("#inputtype");
    await type?.selectOption("String");
    // Fill the discription
    await functions.fill_Text(pageobject.descriptionSelector, 'Full Name of User');
    // select the required check box
    await page.waitForSelector(pageobject.RequiredcheckboxLocator);
    await page.check(pageobject.RequiredcheckboxLocator);
    // Click on next button
    await functions.submit();
    // Fill the min length for field
    await functions.fill_Text(pageobject.minlengthlocator, '5');
    // Fill the max length for field
    await functions.fill_Text(pageobject.maxlengthlocator, '50');
    // Fill the error message for field
    await functions.fill_Text(pageobject.errormessagelocator, 'incorrect value');
    // click on next button
    await functions.submit();
    // click on finish button
    await functions.submit();
    // check visibility of full name field added
    await customAssert('Full name field should be visible on fields ', async () => {
      await page.waitForSelector(pageobject.fullnamefieldlocator);
      await expect(page.locator(pageobject.fullnamefieldlocator)).toBeVisible();
      // Assert the label of Full name field 
      await expect(page.locator(pageobject.fullnamefieldlocator)).toHaveText('Full name');
    });
    // check required tag for full name field
    await customAssert('Full name field should should have required tag ', async () => {
      await page.waitForSelector(pageobject.fullnamerequiredtaglocator);
      await expect(page.locator(pageobject.fullnamerequiredtaglocator)).toBeVisible();
      // Assert the requierd tag text
      await expect(page.locator(pageobject.fullnamerequiredtaglocator)).toHaveText('Required');
    });
    // check full name field type is string
    await customAssert('Full Name field should be string type ', async () => {
      await page.waitForSelector(pageobject.Stringtypelocator);
      await expect(page.locator(pageobject.Stringtypelocator)).toBeVisible();
      // Assert the Variable type for Full name field
      await expect(page.locator(pageobject.Stringtypelocator)).toHaveText('String');
    });
    // check variable name for full name field is visible
    await customAssert('Variable name for full name should be full_name and visible ', async () => {
      await page.waitForSelector(pageobject.fullnamevariablelocator);
      await expect(page.locator(pageobject.fullnamevariablelocator)).toBeVisible();
      // Assert the variable name for full name
      await expect(page.locator(pageobject.fullnamevariablelocator)).toHaveText('full_name');
    });
    // check delete button for full name field is visible
    await customAssert('Delete button for full name field should be exist ', async () => {
      await page.waitForSelector(pageobject.deletefieldbutton);
      await expect(page.locator(pageobject.deletefieldbutton).nth(0)).toBeVisible();
    });
  });

  // Add Date of birth field in the table
  test('Add Date of birth field in the table', async () => {
    // click table button
    await functions.click_table();
    // Go to my table
    await page.waitForSelector(pageobject.mytable);
    await page.click(pageobject.mytable);
    // click on add field button
    await page.waitForSelector(pageobject.addFieldButtonLocator);
    await page.click(pageobject.addFieldButtonLocator);
    // Fill the lable name
    await functions.fill_Text(pageobject.labelTextboxlocator, 'Date of birth');
    // select the input type
    const type = await page.$("#inputtype");
    await type?.selectOption("Date");
    // Fill the discription
    await functions.fill_Text(pageobject.descriptionSelector, 'Date of birth of User');
    // Click on next button
    await functions.submit();
    // click on next button again
    await functions.submit();
    // check visibility of Date of birth field added
    await customAssert('DOB field for table should be visible ', async () => {
      await expect(page.locator(pageobject.dobfieldlocator)).toBeVisible();
      // Assert the lable of Date of birth field
      await expect(page.locator(pageobject.dobfieldlocator)).toHaveText('Date of birth');
    });
    // check DOB field type is Date
    await customAssert('DOB field should have Date type ', async () => {
      await expect(page.locator(pageobject.datetypelocator)).toBeVisible();
      // Assert the variable type for DOB field
      await expect(page.locator(pageobject.datetypelocator)).toHaveText('Date');
    });
    // check varable name for dob field is visible
    await customAssert('Variable name for DOB field should be date_of_birth ', async () => {
      await expect(page.locator(pageobject.DOBvariablelocator)).toBeVisible();
      // Assert the variable name for Date of birth field
      await expect(page.locator(pageobject.DOBvariablelocator)).toHaveText('date_of_birth');
    });
    // check delete button for DOB field is visible
    await customAssert('Delete button for DOB field should be exist ', async () => {
      await expect(page.locator(pageobject.deletefieldbutton).nth(0)).toBeVisible();
    });
  });

  // Add Address field in the table
  test('Add Address field in the table', async () => {
    // click table button
    await functions.click_table();
    // Go to my table
    await page.waitForSelector(pageobject.mytable);
    await page.click(pageobject.mytable);
    // click on add field button
    await page.waitForSelector(pageobject.addFieldButtonLocator);
    await page.click(pageobject.addFieldButtonLocator);
    // Fill the lable name
    await functions.fill_Text(pageobject.labelTextboxlocator, 'Address');
    // select the input type
    const type = await page.$("#inputtype");
    await type?.selectOption("String");
    // Fill the discription
    await functions.fill_Text(pageobject.descriptionSelector, 'Address of User');
    // Click on next button
    await functions.submit();
    // Fill the min length for field
    await functions.fill_Text(pageobject.minlengthlocator, '20');
    // Fill the max length for field
    await functions.fill_Text(pageobject.maxlengthlocator, '100');
    // click on next button
    await functions.submit();
    // click on finish button
    await functions.submit();
    // check visibility of Address field added
    await customAssert('Address field should be visible', async () => {
      await expect(page.locator(pageobject.addressfieldlocator)).toBeVisible();
      // Assert the label for Address field
      await expect(page.locator(pageobject.addressfieldlocator)).toHaveText('Address');
    });
    // check address field type is string
    await customAssert('Address field type should be string', async () => {
      await expect(page.locator(pageobject.Stringtypelocator).nth(0)).toBeVisible();
      // Assert the variable type for Address field
      await expect(page.locator(pageobject.Stringtypelocator).nth(0)).toHaveText('String');
    });
    // check variable name for address field is visible
    await customAssert('variable name for Address field should be adress and visible ', async () => {
      await expect(page.locator(pageobject.addressvariablelocator)).toBeVisible();
      // Assert the variable name for address field
      await expect(page.locator(pageobject.addressvariablelocator)).toHaveText('address');
    });
    // check delete button for address field is visible
    await customAssert('Delete button for Address field should be visible ', async () => {
      await expect(page.locator(pageobject.deletefieldbutton).nth(0)).toBeVisible();
    });
  });

  // Add Row and value in the table
  test('Add row and insert value in the coulmns', async () => {
    // click table button
    await functions.click_table();
    // Go to my table
    await page.waitForSelector(pageobject.mytable);
    await page.click(pageobject.mytable);
    // Click on edit link
    await page.waitForSelector(pageobject.EditlinkLocator);
    await page.click(pageobject.EditlinkLocator);
    // Click on add row button
    await customAssert('Add row button on table should be visible ', async () => {
      await expect(page.locator(pageobject.addrowlocator)).toBeVisible();
      // Assert the lable for add row button
      await expect(page.locator(pageobject.addrowlocator)).toHaveText('Add row');
    });
    await page.waitForTimeout(10000);
    // click on add row button
    await page.waitForSelector(pageobject.addrowlocator);
    await page.click(pageobject.addrowlocator);
    // click on tab cell to activate it
    await page.waitForSelector(pageobject.tab1locater);
    await page.click(pageobject.tab1locater);
    // enter value in cell
    await page.keyboard.type('First Name');
    // click on tab cell to activate it
    await page.waitForSelector(pageobject.tab2locator);
    await page.click(pageobject.tab2locator);
    // Check if the calendar is visible
    await customAssert('Calander should be open after clicking on date column ', async () => {
      const calendarVisible = await page.isVisible(pageobject.calendarlocator);
      expect(calendarVisible).toBe(true);
    });
    // enter year value in cell
    await page.fill(pageobject.yearlocator, '2024')
    // select month in calendar
    await page.selectOption(pageobject.monthlocator, { label: 'June' });
    // Click on the date using the provided selector
    await page.waitForSelector(pageobject.datelocator);
    await page.click(pageobject.datelocator);
    // click on tab cell to activate it
    await page.waitForSelector(pageobject.tab3locator);
    await page.click(pageobject.tab3locator)
    // enter address value in cell
    await page.keyboard.type('HN 01, WN 26 noida india');
  });

  //download table as csv
  test('download table as csv file', async () => {
    // Click table button
    await functions.click_table();
    await page.waitForSelector(pageobject.Defaultusertable);
    await page.click(pageobject.Defaultusertable);

    // Wait for the download event and click the download link
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click(pageobject.downloadlinklocator)
    ]);

    // Get the path of the downloaded file
    const downloadPath = await download.path();

    // Verify the downloaded file
    if (downloadPath) {
      console.log('File downloaded to:', downloadPath);

      // Check if the file exists
      if (fs.existsSync(downloadPath)) {
        console.log('File exists:', downloadPath);

        // Optionally, read the file content
        const fileContent = fs.readFileSync(downloadPath, 'utf8');
        console.log('File content:', fileContent);

        // Assert the file content (adjust based on your expected content)
        await customAssert('File content should be correct', async () => {
          // Assert the content on table : id,full_name,Date_of_birth,address
          expect(fileContent).toContain('email,id,role_id,dob,address');
        });
      } else {
        throw new Error('Downloaded file not found.');
      }
    } else {
      throw new Error('Download event not triggered.');
    }
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
    await page.fill(pageobject.viewdiscriptiontext, 'view for table');

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
    await page.waitForTimeout(25000);
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
    await page.fill(pageobject.viewdiscriptiontext, 'view for table');
    // validate the view pattern in table dropdown
    await customAssert('View Pattern should be Edit', async () => {
      // select the Edit pattern
      const EditPattern = await page.$("#inputviewtemplate");
      await EditPattern?.selectOption("Edit");
    });
    // submit the page
    await functions.submit();
    // drag and drop the page source on the page
    await page.waitForTimeout(25000);
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
    // await page.waitForTimeout(4000);
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
    await page.fill(pageobject.viewdiscriptiontext, 'view for table');
    // validate the view pattern in table dropdown
    await customAssert('View Pattern should be Show', async () => {
      // select show pattern
      const ShowPattern = await page.$("#inputviewtemplate");
      await ShowPattern?.selectOption("Show");
    });
    // submit the page
    await functions.submit();
    await page.waitForTimeout(25000);
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

      await page.click(pageobject.showfieldlink);
    });
  });

  // Add table by uplaoding csv
  test('Add table by uploading csv file', async () => {
    // click table button
    await functions.click_table();
    // Click on Create from CSV upload link
    await page.waitForSelector(pageobject.createfromcsvupload);
    await page.click(pageobject.createfromcsvupload);

    // Wait for the file input element to be available
    const fileInput = await page.waitForSelector('input[type="file"]');
    // Set the file input to the desired file
    const filePath = 'Csv_file_to_uplaod/People1.csv'; // Replace with the correct path to your CSV file
    await fileInput.setInputFiles(filePath);
    // fill table name on text box
    await functions.fill_Text(pageobject.InputName, 'csv_Table' + randomString);
    // Click on create button
    await functions.submit();
    // Click on create view from table
    await page.waitForSelector(pageobject.Homecreateview);
    await page.click(pageobject.Homecreateview);
    // input view name and discription
    await page.fill(pageobject.InputName, 'csvView_list');
    await page.fill(pageobject.viewdiscriptiontext, 'view for csv table');
    // submit the page
    await functions.submit();
    // click on next button
    await page.waitForSelector(pageobject.nextoption);
    await page.click(pageobject.nextoption);
    // click on next button
    await functions.submit();
    await page.click(pageobject.finishbuttonprimary);
    // id field should be visible
    await customAssert('Assert id field is visible', async () => {
      await expect(page.locator(pageobject.idfieldlocator)).toBeVisible();
      await expect(page.locator(pageobject.idfieldlocator)).toHaveText('ID');
    });
    // id field variable type should be integer
    await customAssert('Assert id field type is integer', async () => {
      await expect(page.locator(pageobject.idtypelocator)).toBeVisible();
      await expect(page.locator(pageobject.idtypelocator)).toHaveText('Integer');
    });
    // Full Name field should be visible
    await customAssert('Assert Full name field is visible', async () => {
      await expect(page.locator(pageobject.fullnamefieldlocator)).toBeVisible();
      await expect(page.locator(pageobject.fullnamefieldlocator)).toHaveText('Full name');
    });
    // Full name field type should be string
    await customAssert('Assert Full name field is string type and visible', async () => {
      await expect(page.locator(pageobject.csvnamestringtype)).toBeVisible();
      await expect(page.locator(pageobject.csvnamestringtype)).toHaveText('String');
    });
    // DOB field should be visible
    await customAssert('Assert DOB field is visible', async () => {
      await expect(page.locator(pageobject.dobfieldlocator)).toBeVisible();
      await expect(page.locator(pageobject.dobfieldlocator)).toHaveText('Date of birth');
    });
    // DOB field type should be Date
    await customAssert('Assert DOB field is Date type and visible', async () => {
      await expect(page.locator(pageobject.datetypelocator)).toBeVisible();
      await expect(page.locator(pageobject.datetypelocator)).toHaveText('Date');
    });
    // Adress field should be visible
    await customAssert('Assert address field is string type and visible', async () => {
      await expect(page.locator(pageobject.addressfieldlocator)).toBeVisible();
      await expect(page.locator(pageobject.addressfieldlocator)).toHaveText('Address');
    });
    // Address field type should be String
    await customAssert('Assert address field is string type and visible', async () => {
      await expect(page.locator(pageobject.csvaddressstringtype)).toBeVisible();
      await expect(page.locator(pageobject.csvaddressstringtype)).toHaveText('String');
    });
    // click on new view link
    await page.waitForSelector(pageobject.newviewfromtable);
    await page.click(pageobject.newviewfromtable);
  });

  //clear all tables
  // test('Navigate to setting page and clear all changes', async ({ browser }) => {
  //   functions = new PageFunctions(page);
  //   await functions.clear_Data();
  // });
});
