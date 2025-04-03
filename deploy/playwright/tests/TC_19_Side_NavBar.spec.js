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
    let randomString;

    test.beforeAll(async ({ browser }) => {
        // Initialize the log file
        Logger.initialize();

        // Create a new browser context with HTTPS error ignored
        context = await browser.newContext({ ignoreHTTPSErrors: true });
        page = await context.newPage();

        // Set the viewport for a consistent test screen size
        await page.setViewportSize({ width: 1350, height: 720 });

        // Initialize page functions and locators
        functions = new PageFunctions(page);
        pageobject = new PageObject(page);

        // Navigate to the base URL and log in
        await functions.navigate_To_Base_URL(baseURL, derivedURL);
        await functions.login('myproject19july@mailinator.com', 'myproject19july');
        await functions.submit();
        // await functions.clear_Data();

    });
    test.beforeEach(async ({ browser }) => {
        // Assign a value to randomString here
        randomString = PageFunctions.generate_Random_String(10);

    });
    test.afterAll(async () => {
        // Ensure the page and context close properly after tests
        await page.close();
        await context.close();
    });

    test('Validate Side Navbar', async () => {
        await functions.install_any_bootstrap_theme();
        await page.selectOption(pageobject.inputmenu_style, { value: 'Side Navbar' });
        await functions.submit();
           await page.click(pageobject.saltcornImageLink);
            await page.goto(pageobject.tableclick);
            // create table
            await customAssert('Page url should be /table ', async () => {
                expect(page.url()).toBe(baseURL + derivedURL + 'table');
            });
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

    test('Create csv upload', async () => {
        await page.goto(pageobject.create_CSV);
        await customAssert('Page url should be /create-from-csv', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'table/create-from-csv');
        });

        // Wait for the file input element to be available
        const fileInput = await page.waitForSelector('input[type="file"]');
        // Set the file input to the desired file
        const filePath = 'Csv_file_to_uplaod/People1.csv'; // Replace with the correct path to your CSV file
        await fileInput.setInputFiles(filePath);
        // fill table name on text box
        await functions.fill_Text(pageobject.InputName, 'csv_Table');
        // Click on create button
        await functions.submit();
        // Click on create view from table
        await page.waitForSelector(pageobject.Homecreateview);
        await page.click(pageobject.Homecreateview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'csvView_list');
        await page.fill(pageobject.discriptiontext, 'view for csv table');
        // submit the page
        await functions.submit();
        // click on next button
        await page.waitForTimeout(5000);
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
    });

    test('Create new page', async () => {
        // Create a new page with the generated random string
        await page.goto(pageobject.pageclick);
        await customAssert('Page url should be /pageedit', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'pageedit');
        });
        await functions.create_New_Page('My_project_' + randomString);
        await page.waitForTimeout(5000);
        // Drag and drop the text source
        await page.waitForSelector(pageobject.textSource);
        await functions.drag_And_Drop(pageobject.textSource, pageobject.target);
        await functions.fill_Text(pageobject.textlocator, '');
        await page.waitForTimeout(2000);
        await functions.fill_Text(pageobject.textlocator, 'Testing the placeholder');
        //  check hello world have text testing
        await customAssert('Hello world should have text Testing the placeholder', async () => {
            await expect(page.locator(pageobject.textlocator)).toContainText('Testing the placeholder');
        });
        // Check Text settings
        await customAssert('Text settings should be visible', async () => {
            await expect(page.getByText('Text settings')).toBeVisible();
        });
        await customAssert('Text to display should be visible', async () => {
            await expect(page.getByText('Text to display')).toBeVisible();
        });
    });

    test('Create new view', async () => {
        // Navigate to the view creation page
        await page.click(pageobject.saltcornImageLink);
        await page.goto(pageobject.viewclick);
        // Assert the view edit URL
        await customAssert('Page URL should be /viewedit', async () => {
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
          // Cleanup state
          await page.goto(baseURL + derivedURL + pageobject.admin_Clear_All);
          await functions.navi_Setting_Dropdown_Clear();
    });
});

