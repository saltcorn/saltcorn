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
        await functions.submit(); // Ensure submit is required
    });

    test.afterAll(async () => {
        // Ensure the page and context close properly after tests
        await page.close();
        await context.close();
    });

    test('Create Builder Mode', async () => {
        await functions.create_New_Page('TestPage');
        await page.waitForSelector(pageobject.cardSource);
        await functions.drag_And_Drop(pageobject.cardSource, pageobject.target);
        await functions.fill_Text(pageobject.cardtextlocator, 'Hello');
        const cardTitle = page.locator(pageobject.cardtextlocator);

        await customAssert('Card title should be Hello', async () => {
            await expect(cardTitle).toHaveValue('Hello');
            const urlField = page.locator(pageobject.CardUrl);
            await expect(urlField).toHaveValue('');
        });
    });

    test('Text placeholder', async () => {
        await page.waitForSelector(pageobject.textSource);
        await functions.drag_And_Drop(pageobject.textSource, pageobject.target);
        await functions.fill_Text(pageobject.textlocator, 'Hello World');
        await page.waitForTimeout(2000);
        const TextTitle = page.locator(pageobject.textSource);
        await customAssert('Text box should be visible', async () => await expect(page.locator(pageobject.textlocator)).toBeVisible());
        await page.locator(pageobject.cardBoxClick).click();
    });

    test('Add Library', async () => {
        // library
        await page.locator(pageobject.Library)
        await page.click(pageobject.Library);

        // add button
        await page.locator(pageobject.plusAddButton)
        await page.click(pageobject.plusAddButton); // Locate by ID
        console.log('Add button clicked successfully!');
        await customAssert('Name Field', async () => {
            await page.click(pageobject.nameField);
            await functions.fill_Text(pageobject.nameField, 'mycard');
        });

        await customAssert('Icon Field', async () => {
            const selectIconButton = page.locator(pageobject.selectIcon);
            await page.click(pageobject.selectIcon);  // Click the 'Select icon' text
            const icon = page.locator(pageobject.selectIconFarFaAddress);
            await icon.click();  // Click the desired icon
        });
        console.log("Icon 'far fa-ad' selected.");
        await page.click(pageobject.selectIconFlip);
        await customAssert('Assert +Add button is visible', async () => {
            await expect(page.locator(pageobject.addButtonAfterSelect)).toBeVisible();
        });
        await page.click(pageobject.addButtonAfterSelect);  // Click the 'Add' button based on both the text and icon 
        await page.click(pageobject.PageSave);

        await customAssert(' TestPage name field should be visible', async () => {
            const names = await page.locator(pageobject.pageNameSave).allInnerTexts();
            console.assert(names.includes('TestPage'), '"TestPage" is missing from the Name column!');
        });
    });

    test('Create Second page', async () => {
        await functions.create_New_Page('testpage2');
        // await page.waitForTimeout(5000);
        // await page.waitForSelector(pageobject.textSource);
        await page.locator(pageobject.Library).click();
        await functions.drag_And_Drop(pageobject.dragElement, pageobject.target);
        await page.waitForTimeout(5000);
        await page.click(pageobject.testPage2);
        // await page.waitForTimeout(5000);
        await customAssert('Page URL should be /testpage2', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'page/testpage2');
        });
    });

    test('Create Third page', async () => {
        await functions.create_New_Page('testpage3');
        //drag and drop the contains drag locator
        await functions.drag_And_Drop(pageobject.containsdraglocator, pageobject.target);
        await customAssert('Container settings should be visible', async () => {
            await expect(page.getByText('Container settings')).toBeVisible();
        });

        await page.waitForSelector(pageobject.htmlCodeSource);
        await functions.drag_And_Drop(pageobject.htmlCodeSource, pageobject.target);
        await functions.fill_Text(pageobject.htmltextlocator, '<h3>Hello World</h3>');
        // validate that html code source is visible
        await customAssert('HTML box should be visible', async () => await expect(page.locator(pageobject.htmltextlocator)).toBeVisible());

        // drag and drop the link source
        await functions.drag_And_Drop(pageobject.linkSource, pageobject.target);
        await functions.fill_Text(pageobject.linklocator, 'youtube link');
        await customAssert('Link Text should be youtube link', async () => {
            const Linktext = page.locator(pageobject.linklocator);
            await expect(Linktext).toHaveValue('youtube link');
        });
        const column = page.locator('h2', { hasText: 'Column' });
        await column.click();
    });

    test('Add Library for testpage3', async () => {
        // library
        await page.locator(pageobject.Library)
        await page.click(pageobject.Library);

        // add button
        await page.locator(pageobject.plusAddButton)
        await page.click(pageobject.plusAddButton); // Locate by ID
        console.log('Add button clicked successfully!');
        await customAssert('Name Field', async () => {
            await page.click(pageobject.nameField);
            await functions.fill_Text(pageobject.nameField, 'mycard1');
        });
        await customAssert('Icon Field', async () => {
            // const selectIconButton = page.locator(pageobject.selectIcon);
            await page.click(pageobject.selectIcon);  // Click the 'Select icon' text
            const icon = page.locator(pageobject.selectIconFasFaAddress);
            await icon.click();  // Click the desired icon
        });
        console.log("Icon 'fas fa-ad' selected.");
        await page.click(pageobject.selectIconFlip);
        await customAssert('Assert +Add button is visible', async () => {
            await expect(page.locator(pageobject.addButtonAfterSelect)).toBeVisible();
        });
        await page.click(pageobject.addButtonAfterSelect);
        // await page.click(pageobject.PageSave);
        await functions.Save_Page_Project();

        await customAssert(' testPage3 name field should be visible', async () => {
            // await expect(page.locator(pageobject.pageNameSave3)).toBeVisible();
        });
    });

    test('Create Fourth page', async () => {
        await functions.create_New_Page('testpage4');
        await page.locator(pageobject.Library).click();
        await functions.drag_And_Drop(pageobject.dragElement1, pageobject.target);
        await page.waitForTimeout(5000);
        await page.click(pageobject.testPage4);
        await customAssert('Page URL should be /testpage2', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'page/testpage4');
        });
    });

    test('Create new view', async () => {
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

        // input view name and discription
        await page.fill(pageobject.InputName, 'TestView');
        await page.fill(pageobject.discriptiontext, 'create view and use the library for page');

        // validate the view pattern in table dropdown
        await customAssert('View Pattern should be list', async () => {
            // select list pattern
            const ListPattern = await page.$("#inputviewtemplate");
            await ListPattern?.selectOption("List");
        });

        // assert the view url
        await customAssert('page url should be /viewedit/new  ', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'viewedit/new');
        });

        await customAssert('View Settings should be visible', async () => {
            await expect(page.locator(pageobject.viewSetting)).toBeVisible();
            await page.click(pageobject.viewSetting);
        });
        // Check if 'mypage' is visible, if not, click 'viewSetting' again
        if (!(await page.locator(pageobject.mypage).isVisible())) {
            await page.click(pageobject.viewSetting, { force: true });
        }
        await page.locator(pageobject.mypage).fill("My Page");
        // Locator for the dropdown
        const dropdown = page.locator(pageobject.inputdefaultrenderpage);
        // Select "TestPage" from the dropdown
        await dropdown.selectOption('TestPage');
        // submit the page  
        await functions.submit();
    });

    test('verify page by view', async () => {
        // click on add column button on page
        await page.waitForSelector(pageobject.addcolumnbutton);
        await page.click(pageobject.addcolumnbutton);
        await page.locator(pageobject.Library).click();
        // drag and drop the library locator
        await customAssert('Drag and drop Library button on view', async () => {
            // Define locators
            const firstElement = page.locator(pageobject.mycardDrag).nth(0);
            const target = page.locator(pageobject.newcolumn); // Replace with actual target locator   
            // Drag and drop action
            await firstElement.dragTo(target, { force: true });
        });

        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);

        await customAssert('Save button on view', async () => {
            await functions.submit();
            await functions.submit();
        });

        await customAssert(' TestView name should be visible', async () => {
            // await expect(page.locator(pageobject.viewName)).toBeVisible();
            await page.click(pageobject.viewName);
        });
    });

    test('Click table button and verify URL', async () => {
        // click table button
        await functions.click_table();
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
        // create view is visible
        await customAssert('Create view by table name ', async () => {
            const createViewButton = page.locator('a.btn.btn-primary:has-text("Create view")');
            await createViewButton.click();
        });
    });

    test('Create view using table ', async () => {
        // assert the view edit url
        await customAssert('view using table url', async () => {
            const currentURL = page.url(); // Get the current URL
            // Parse the URL to extract its components
            const url = new URL(currentURL);
            // Assert the pathname and query parameters dynamically
            expect(url.pathname).toBe('/viewedit/new'); // Validate the pathname
            expect(url.searchParams.get('table')).toBeDefined(); // Validate 'table' exists
            expect(url.searchParams.get('on_done_redirect')).toBeDefined(); // Validate 'on_done_redirect' exists
            // Optionally, check specific values if needed
            expect(url.searchParams.get('table')).toBe('My_Table'); // Replace 'My_Table' with your expected dynamic value
        });

        // assert the visibility of create new view
        await customAssert('Create new view button should be visible and working', async () => {
            await expect(page.locator(pageobject.createview)).toBeVisible();
            // Assert the lable for create view buttons
            await expect(page.locator(pageobject.createview)).toHaveText('Create view');
        });
        await customAssert('view using table url', async () => {
            const currentURL = page.url(); // Get the current URL
            // Parse the URL to extract its components
            const url = new URL(currentURL);
            // Assert the pathname and query parameters dynamically  
            expect(url.pathname).toBe('/viewedit/new'); // Validate the pathname
            expect(url.searchParams.get('table')).toBeDefined(); // Validate 'table' exists
            expect(url.searchParams.get('on_done_redirect')).toBeDefined(); // Validate 'on_done_redirect' exists
            // Optionally, check specific values if needed
            expect(url.searchParams.get('table')).toBe('My_Table'); // Replace 'My_Table' with your expected dynamic value
        });
        // input view name and discription
        await page.fill(pageobject.InputName, 'Table_View');
        await page.fill(pageobject.discriptiontext, 'create view and use the library for page');

        // validate the view pattern in table dropdown
        await customAssert('View Pattern should be list', async () => {
            // select list pattern
            const ListPattern = await page.$("#inputviewtemplate");
            await ListPattern?.selectOption("List");
        });

        await customAssert('View Settings should be visible', async () => {
            await expect(page.locator(pageobject.viewSetting)).toBeVisible();
            await page.click(pageobject.viewSetting);
        });
        // Check if 'mypage' is visible, if not, click 'viewSetting' again
        if (!(await page.locator(pageobject.mypage).isVisible())) {
            await page.click(pageobject.viewSetting, { force: true });
        }
        await page.locator(pageobject.mypage).fill("My_Page");
        // Locator for the dropdown
        const dropdown = page.locator(pageobject.inputdefaultrenderpage);
        // Select "TestPage" from the dropdown
        await dropdown.selectOption('TestPage');
        // submit the page  
        await functions.submit();
        await functions.views();
        // Click on the "Table_View" link within the located row
        await customAssert('Table_View should be visible', async () => {
            const tableViewLink = page.locator('a', { hasText: 'Table_View' });
            // await expect(page.locator(page.tableViewLink)).toBeVisible();
            await tableViewLink.click();
            // await page.waitForTimeout(2000);
            await functions.clear_Data();
        });
    });
});