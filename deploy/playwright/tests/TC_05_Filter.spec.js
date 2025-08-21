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

    // Add status fieled in table
    test('Add status fieled in table', async () => {
        // click table button
        await functions.click_table();
        // Go to my table
        await page.click(pageobject.mytable);
        // click on add field button
        await page.click(pageobject.addFieldButtonLocator);
        // Fill the lable name
        await functions.fill_Text(pageobject.labelTextboxlocator, 'Status');
        // select the input type
        const type = await page.$("#inputtype");
        await type?.selectOption("String");
        // Fill the discription
        await functions.fill_Text(pageobject.descriptionSelector, 'Status of User');
        // Click on next button
        await functions.submit();
        // Fill the status option in option field
        await functions.fill_Text(pageobject.optioninput, 'Member, Prospect, Lapsed');
        // click on next button
        await functions.submit();
        // click on finish button
        await functions.submit();
        await page.click(pageobject.EditlinkLocator);
        // Click on add row button
        await customAssert('status field on table should be visible ', async () => {
            await expect(page.locator(pageobject.statustab)).toBeVisible();
            await page.click(pageobject.statustab);
            await page.click('text=Member');
        });
    });

    // Add status field in list view
    test('Add status field in list view', async () => {
        await functions.views();
        await page.click(pageobject.configurelistview);
        await customAssert('Remove Show link from view', async () => {
            await page.click(pageobject.column5);
            await page.click(pageobject.deletebutton);
        });
        // click on add column button on page
        await customAssert('Add status field in view', async () => {
            await page.click(pageobject.addcolumnbutton);
            await functions.fill_Text(pageobject.headerlabel, 'Status');
            await functions.drag_And_Drop(pageobject.fieldsource, pageobject.newcolumn);
            await page.selectOption(pageobject.fielddropdown, { label: 'Status' });
            await page.selectOption(pageobject.fieldViewdropdown, { label: 'as_text' });
        });
        await page.waitForTimeout(2500);
        //await page.click(pageobject.nextoption);
        await functions.views();
        await page.click(pageobject.newviewlink);
        await customAssert('Assert the visibility of status field on list view', async () => {
            await expect(page.locator(pageobject.statusfield)).toBeVisible();
        });
    });

    // create new view with Filter view pattern
    test('create new view with Filter view pattern', async () => {
        await functions.views();
        // click on create new view
        await page.waitForSelector(pageobject.createnewview);
        await page.click(pageobject.createnewview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'Filter');
        await page.fill(pageobject.discriptiontext, 'view for Filter');
        // validate the view pattern in table dropdown
        await customAssert('View Pattern should be Filter', async () => {
            // select the Edit pattern
            const EditPattern = await page.$("#inputviewtemplate");
            await EditPattern?.selectOption("Filter");
        });
        // submit the page
        await functions.submit();
        await page.waitForTimeout(1000);
        // add new input box in page
        await functions.drag_And_Drop(pageobject.fieldsource, pageobject.target);
        // click on field dropdown for field
        await customAssert('Select Status in field dropdown', async () => {
            await page.selectOption(pageobject.fielddropdown, { label: 'Status' });
        });
        await customAssert('Select edit in field view dropdown', async () => {
            await page.selectOption(pageobject.fieldViewdropdown, { label: 'edit' });
        });
        // click on next page
        await page.click(pageobject.nextoption);
        // click on finish button
        await functions.views();
        await page.click(pageobject.Filterview);
        await customAssert('Select Member in status dropdown', async () => {
            await page.click(pageobject.statusDropdown);
            await page.selectOption(pageobject.statusDropdown, { label: 'Member' });
        });
    });

    // Create new page for Filter
    test('Create new page for Filter', async () => {
        await functions.create_New_Page('Filtered_page');
        await page.waitForTimeout(1000);
        await functions.drag_And_Drop(pageobject.viewsource, pageobject.target);
        await customAssert('Select NewView_List in view to show dropdown', async () => {
            await page.click(pageobject.View2Showdropdown);
            await page.click(pageobject.view2list, { force: true });
        });
        await functions.drag_And_Drop(pageobject.viewsource, pageobject.target);
        await customAssert('Select Filter in view to show dropdown', async () => {
            await page.click(pageobject.View2Showdropdown);
            await page.click(pageobject.view2Filter, { force: true });
        });
        await page.waitForTimeout(1000);
        await functions.Save_Page_Project();
        await page.click(pageobject.newPage_sidebar);
        await page.click(pageobject.FilterPage);
        // await page.waitForTimeout(2000);
        await customAssert('Select Status dropdown should be present', async () => {
            await expect(page.locator(pageobject.pagestatusdropdown)).toBeVisible();
            await page.click(pageobject.pagestatusdropdown);
        });
        await customAssert('Select Member in status dropdown', async () => {
            await page.selectOption(pageobject.pagestatusdropdown, { label: 'Member' });
        });
        await customAssert('Select Prospect in status dropdown', async () => {
            await page.selectOption(pageobject.pagestatusdropdown, { label: 'Prospect' });
        });
        await customAssert('Select Lapsed in status dropdown', async () => {
            await page.selectOption(pageobject.pagestatusdropdown, { label: 'Lapsed' });
        });
    });

    // Add Toggle on Filter View 
    test('Add Toggle on Filter View', async () => {
        await functions.views();
        await page.click(pageobject.configureFilterview);
        await customAssert('Remove status dropdown from view', async () => {
            await page.click(pageobject.pageinputstatus);
            await page.click(pageobject.deletebutton);
        });
        await customAssert('Add toggle for Member', async () => {
            await functions.drag_And_Drop(pageobject.togglesource, pageobject.target);
            await page.selectOption(pageobject.fielddropdown, { label: 'Status' });
            await functions.fill_Text(pageobject.inputValueField, 'Member');
        });
        await customAssert('Add toggle for Prospect', async () => {
            await functions.drag_And_Drop(pageobject.togglesource, pageobject.target);
            await page.selectOption(pageobject.fielddropdown, { label: 'Status' });
            await functions.fill_Text(pageobject.inputValueField, 'Prospect');
        });
        await customAssert('Add toggle for lapsed', async () => {
            await functions.drag_And_Drop(pageobject.togglesource, pageobject.target);
            await page.selectOption(pageobject.fielddropdown, { label: 'Status' });
            await functions.fill_Text(pageobject.inputValueField, 'Lapsed');
        });
        await page.waitForTimeout(1000);
        await page.click(pageobject.nextoption);
        await page.click(pageobject.newPage_sidebar);
        await page.click(pageobject.FilterPage);
        await customAssert('Assert the member toggle button on page', async () => {
            await expect(page.locator(pageobject.membertoggle)).toBeVisible();
            await page.click(pageobject.membertoggle);
        });
        await customAssert('Assert the prospects toggle button on page', async () => {
            await expect(page.locator(pageobject.Prospecttoggle)).toBeVisible();
            await page.click(pageobject.Prospecttoggle);
        });
        await customAssert('Assert the prospects toggle button on page', async () => {
            await expect(page.locator(pageobject.Lapsedtoggle)).toBeVisible();
            await page.click(pageobject.Lapsedtoggle);
        });
    });

    // Add checkbox and search box in filter view
    test('Add checkbox and search box in filter view', async () => {
        await functions.views();
        await page.click(pageobject.configureFilterview);
        await page.click(pageobject.target);
        await page.click(pageobject.deletecontentButton);
        await functions.drag_And_Drop(pageobject.fieldsource, pageobject.target);
        await customAssert('Select Status in field dropdown', async () => {
            await page.selectOption(pageobject.fielddropdown, { label: 'Status' });
        });
        await customAssert('Select checkbox_group in field view dropdown', async () => {
            await page.selectOption(pageobject.fieldViewdropdown, { label: 'checkbox_group' });
        });
        await page.waitForTimeout(1000);
        await page.click(pageobject.nextoption);
        await page.click(pageobject.newPage_sidebar);
        await page.click(pageobject.FilterPage);
        await page.click(pageobject.memberCheckbox);
        await page.click(pageobject.prospectCheckbox);
        await page.click(pageobject.lapsedCheckbox);

        // Add search box in filter view
        await functions.views();
        await page.click(pageobject.configureFilterview);
        await page.click(pageobject.target);
        await page.click(pageobject.deletecontentButton);
        await customAssert('Add search box in view', async () => {
            await functions.drag_And_Drop(pageobject.SearchLocator, pageobject.target);
        });
        // Check the has dropdown for searchbox
        await page.click(pageobject.hasdropdowncheckbox);
        await customAssert('Drag checkboxes in search box', async () => {
            await functions.drag_And_Drop(pageobject.fieldsource, pageobject.searchInputGroup);
        });
        await customAssert('Select Status in field dropdown', async () => {
            await page.selectOption(pageobject.fielddropdown, { label: 'Status' });
        });
        await page.waitForTimeout(1000);
        await page.click(pageobject.nextoption);
        await page.click(pageobject.newPage_sidebar);
        await page.click(pageobject.FilterPage);
        // await page.click(pageobject.memberCell);
        await page.click(pageobject.dropdownButton, { force: true });
        await customAssert('Member checkbox in searchbar dropdown should be visible', async () => {
            await expect(page.locator(pageobject.memberDDCheckbox)).toBeVisible();
            await page.click(pageobject.memberDDCheckbox);
        })
        await functions.fill_Text(pageobject.searchbar, 'First Name');
    });

    // Create new page for fixed status
    test('Create new page for Fixed state', async () => {
        await functions.create_New_Page('Fixed_state');
        await page.waitForTimeout(1000);
        await functions.drag_And_Drop(pageobject.viewsource, pageobject.target);
        await customAssert('Select NewView_List in view to show dropdown', async () => {
            await page.click(pageobject.View2Showdropdown);
            await page.click(pageobject.view2list, { force: true });
        });
        await customAssert('Select Fixed in state dropdown', async () => {
            await page.selectOption(pageobject.statedropdown, { label: 'Fixed' });
        });
        await customAssert('Select member in status dropdown', async () => {
            await page.selectOption(pageobject.statusfixed, { label: 'Member' });
        });
        await page.waitForTimeout(1000);
        await functions.Save_Page_Project();
        await page.click(pageobject.newPage_sidebar);
        await page.click(pageobject.FixedStatePage);
        // await customAssert('Data with Member status should be visible', async () => {
        //     await expect(page.locator(pageobject.memberCell)).toBeVisible();
        // })
    });
});