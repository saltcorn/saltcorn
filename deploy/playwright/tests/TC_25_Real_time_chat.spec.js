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

    test('Create Room table', async () => {
        await functions.clear_Data();
        // click table button
        await functions.click_table();
        // Click the "Create table" button
        await page.click(pageobject.createtablebutton);
        // Enter Table name
        await functions.fill_Text(pageobject.InputName, 'Room');
        // Click on next button
        await functions.submit();
        // click on add field button
        await page.waitForSelector(pageobject.addFieldButtonLocator);
        await page.click(pageobject.addFieldButtonLocator);
        // Fill the lable name
        await functions.fill_Text(pageobject.labelTextboxlocator, 'Room Name');
        // select the input type string
        const type = await page.$("#inputtype");
        await type?.selectOption("String");
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
        // Click on edit link
        await page.waitForSelector(pageobject.EditlinkLocator);
        await page.click(pageobject.EditlinkLocator);
        // click on add row button
        await page.waitForLoadState('networkidle');
        // await page.waitForTimeout(2000);
        await page.waitForSelector(pageobject.addrowlocator);
        await page.click(pageobject.addrowlocator);
        // click on tab cell to activate it
        await page.waitForSelector(pageobject.roomcell);
        await page.click(pageobject.roomcell);
        // enter value in cell
        await page.keyboard.type('Room1');
        // Add another row for room
        await page.click(pageobject.addrowlocator);
        // click on tab cell to activate it
        await page.waitForSelector(pageobject.roomcell);
        await page.click(pageobject.roomcell);
        // enter value in cell
        await page.keyboard.type('Room2');
        await page.waitForLoadState('networkidle');
    });

    test('Create Messages table', async () => {
        // Create Messages table
        await functions.click_table();
        // Click the "Create table" button
        await page.click(pageobject.createtablebutton);
        // Enter Table name
        await functions.fill_Text(pageobject.InputName, 'Messages');
        // Click on next button
        await functions.submit();

        // click on add field button
        await page.waitForSelector(pageobject.addFieldButtonLocator);
        await page.click(pageobject.addFieldButtonLocator);
        // add field name
        await functions.fill_Text(pageobject.labelTextboxlocator, 'Content');
        // Click the dropdown to open it
        await page.click('#inputtype');
        // Scroll to the bottom of the dropdown
        await page.evaluate(() => {
            const dropdown = document.querySelector('#inputtype');
            dropdown.scrollTop = dropdown.scrollHeight;
        });
        // Select "type" option
        await page.selectOption('#inputtype', { label: 'String' });
        // click next button
        await functions.submit();
        // click on finish button
        await functions.submit();

        // click on add field button
        await page.waitForSelector(pageobject.addFieldButtonLocator);
        await page.click(pageobject.addFieldButtonLocator);
        // Add field name
        await functions.fill_Text(pageobject.labelTextboxlocator, 'Room');
        // Click the dropdown to open it
        await page.click('#inputtype');
        // Scroll to the bottom of the dropdown
        await page.evaluate(() => {
            const dropdown = document.querySelector('#inputtype');
            dropdown.scrollTop = dropdown.scrollHeight;
        });
        // Select key to room as foreign key for room
        await page.selectOption('#inputtype', { label: 'Key to Room' });
        // Click on next button
        await functions.submit();
        await functions.submit();
        await page.waitForTimeout(2000);

        // click on add field button
        await page.waitForSelector(pageobject.addFieldButtonLocator);
        await page.click(pageobject.addFieldButtonLocator);
        // Enter Field name
        await functions.fill_Text(pageobject.labelTextboxlocator, 'Sender');
        // Click the dropdown to open it
        await page.click('#inputtype');
        // Scroll to the bottom of the dropdown
        await page.evaluate(() => {
            const dropdown = document.querySelector('#inputtype');
            dropdown.scrollTop = dropdown.scrollHeight;
        });
        // Select key to user as foreign key for sender
        await page.selectOption('#inputtype', { label: 'Key to users' });
        // Check require tag
        await page.check(pageobject.RequiredcheckboxLocator);
        // Click on next button
        await functions.submit();
        // Select UserID on summary field
        await customAssert('Select UserID on summary field', async () => {
            await page.selectOption(pageobject.summaryFieldSelect, { label: 'ID [Integer]' });
        });
        // Select Set null On delete of parant row
        await customAssert('Select Set null On delete of parant row ', async () => {
            await page.selectOption(pageobject.onDeleteSelect, { label: 'Fail' });
        });
        // click on submit
        await functions.submit();
        await functions.submit();

        // click on add field button
        await page.waitForSelector(pageobject.addFieldButtonLocator);
        await page.click(pageobject.addFieldButtonLocator);
        // Click the dropdown to open it
        await page.click('#inputtype');
        // Scroll to the bottom of the dropdown
        await page.evaluate(() => {
            const dropdown = document.querySelector('#inputtype');
            dropdown.scrollTop = dropdown.scrollHeight;
        });
        // Select key to user as foreign key for sender
        await page.selectOption('#inputtype', { label: 'Key to Messages' });
        // enter coulmn name
        await functions.fill_Text(pageobject.labelTextboxlocator, 'Reply_to');
        // Click on next button
        await functions.submit();
        // Select UserID on summary field
        await customAssert('Select UserID on summary field', async () => {
            await page.selectOption(pageobject.summaryFieldSelect, { label: 'Sender [Key]' });
        });
        // Select Set null On delete of parant row
        await customAssert('Select Set null On delete of parant row ', async () => {
            await page.selectOption(pageobject.onDeleteSelect, { label: 'Set null' });
        });
        // Click on next button
        await functions.submit();
        await page.waitForLoadState('networkidle');
    });

    test('Create Participants table', async () => {
        // Create Participants table
        await functions.click_table();
        // Click the "Create table" button
        await page.click(pageobject.createtablebutton);
        // Enter Table name
        await functions.fill_Text(pageobject.InputName, 'Participants');
        // Click on next button
        await functions.submit();
        // click on add field button
        await page.waitForSelector(pageobject.addFieldButtonLocator);
        await page.click(pageobject.addFieldButtonLocator);
        // Click the dropdown to open it
        await page.click('#inputtype');

        // Scroll to the bottom of the dropdown
        await page.evaluate(() => {
            const dropdown = document.querySelector('#inputtype');
            dropdown.scrollTop = dropdown.scrollHeight;
        });

        // Select key to room as foreign key for room
        await page.selectOption('#inputtype', { label: 'Key to Room' });

        await page.waitForTimeout(1000);
        // Enter room coulmn
        await functions.fill_Text(pageobject.labelTextboxlocator, 'Room');
        // Click on next button
        await functions.submit();
        await functions.submit();

        // click on add field button
        await page.waitForSelector(pageobject.addFieldButtonLocator);
        await page.click(pageobject.addFieldButtonLocator);
        // Click the dropdown to open it
        await page.click('#inputtype');
        // Scroll to the bottom of the dropdown
        await page.evaluate(() => {
            const dropdown = document.querySelector('#inputtype');
            dropdown.scrollTop = dropdown.scrollHeight;
        });

        // Select key to room as foreign key for user
        await page.selectOption('#inputtype', { label: 'Key to users' });

        await functions.fill_Text(pageobject.labelTextboxlocator, 'User');

        // Click on next button
        await functions.submit();
        // Select UserID on summary field
        await customAssert('Select UserID on summary field', async () => {
            await page.selectOption(pageobject.summaryFieldSelect, { label: 'ID [Integer]' });
        });
        // Select Set null On delete of parant row
        await customAssert('Select Set null On delete of parant row ', async () => {
            await page.selectOption(pageobject.onDeleteSelect, { label: 'Fail' });
        });
        await functions.submit();
    });

    test('create view to add message', async () => {
        await functions.views();
        // Create new view for message edit view
        await page.waitForSelector(pageobject.createnewview);
        await page.click(pageobject.createnewview);

        // input view name and discription
        await page.fill(pageobject.InputName, 'Message_Add');
        await page.fill(pageobject.discriptiontext, 'view for add message');

        // select edit view pattern
        const ListPattern = await page.$("#inputviewtemplate");
        await ListPattern?.selectOption("Edit");

        // Select message table for table name
        await page.locator('#inputtable_name').selectText('Messages');
        // submit the page
        await functions.submit();
        await page.waitForTimeout(2000);

        // click on next button
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);
        // click on next button
        await functions.submit();
        await functions.submit();
        await page.waitForLoadState('networkidle');
    });

    test('create view with Show view pattern', async () => {
        await functions.views();
        // Create new view for message show view
        await page.waitForSelector(pageobject.createnewview);
        await page.click(pageobject.createnewview);

        // input view name and discription
        await page.fill(pageobject.InputName, 'Message_Show');
        await page.fill(pageobject.discriptiontext, 'view for table');

        // select show view pattern
        const ListPattern = await page.$("#inputviewtemplate");
        await ListPattern?.selectOption("Show");
        // Select message table for table name
        await page.locator('#inputtable_name').selectText('Messages');
        // submit the page
        await functions.submit();
        await page.waitForTimeout(2000);
        // click on next button
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);
        await page.waitForTimeout(2000);
    });

    test('create view with list view pattern', async () => {
        await functions.views();
        // Create new view for message list view
        await page.waitForSelector(pageobject.createnewview);
        await page.click(pageobject.createnewview);

        // input view name and discription
        await page.fill(pageobject.InputName, 'Message_List');
        await page.fill(pageobject.discriptiontext, 'view for table');

        // select list pattern
        const ListPattern = await page.$("#inputviewtemplate");
        await ListPattern?.selectOption("List");
        // Select message table for table name
        await page.locator('#inputtable_name').selectText('Messages');
        // submit the page
        await functions.submit();
        await page.waitForTimeout(2000);
        // click on add column button on page
        await page.waitForSelector(pageobject.addcolumnbutton);
        await page.click(pageobject.addcolumnbutton);
        // drag and drop the action locator for delete button
        await page.waitForSelector(pageobject.ActionLocator);
        await functions.drag_And_Drop(pageobject.ActionLocator, pageobject.newcolumn);
        await page.waitForTimeout(2000);
        // click on next button
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);

        // Select view to create message
        await page.waitForSelector(pageobject.viewtocreate);
        await page.click(pageobject.viewtocreate);
        const viewtocreate = await page.$("#inputview_to_create");
        await viewtocreate?.selectOption("Message_Add [Edit]");
        // add lable for view to create message
        await functions.fill_Text(pageobject.labeltocreate, 'Add Message');
        // click on next button
        await functions.submit();
        await functions.submit();
        await page.waitForLoadState('networkidle');
    });

    test('create view with room view pattern', async () => {
        await functions.views();
        // Create new view for chat room
        await page.waitForSelector(pageobject.createnewview);
        await page.click(pageobject.createnewview);

        // input view name and discription
        await page.fill(pageobject.InputName, 'Room');

        // select room pattern
        const roomPattern = await page.$("#inputviewtemplate");
        await roomPattern?.selectOption("Room");

        await page.waitForTimeout(2000);
        await page.click('#inputtable_name');
        // Select Room table for table name
        await page.locator('#inputtable_name').selectOption({ label: 'Room' });
        // submit the page
        await functions.submit();
        await page.waitForTimeout(2000);

        // Select Message.room for message relation
        await page.locator('#inputmsg_relation').selectOption({ label: 'Messages.room' });
        // Select user for sender field
        await page.locator('#inputmsgsender_field').selectOption({ label: 'sender' });
        // Select Message_show for message view
        await page.click('#inputmsgview', { force: true });
        await page.locator('#inputmsgview').selectOption({ label: 'Message_Show' }, { force: true });
        // Select Message_Add for message form
        await page.locator('#inputmsgform').selectOption({ label: 'Message_Add' }, { force: true });
        await functions.submit();
    });

    test('Real time chatroom testing', async () => {
        await functions.views();
        // Configure the edit message view
        await page.click(pageobject.configureAddmsg);
        await functions.drag_And_Drop(pageobject.fieldsource, pageobject.fourthrowcolumn);
        await customAssert('field dropdown should be visible', async () => {
            await page.waitForSelector(pageobject.fielddropdown);
            await expect(page.locator(pageobject.fielddropdown)).toBeVisible();
            await page.click(pageobject.fielddropdown);
            // Select 'Date of birth' from the dropdown
            await page.selectOption('select.form-control.form-select', 'Sender');
        });
        // click on next button
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);

        // Select room view for destination after message add
        await page.selectOption(pageobject.destinationview, { label: 'Room.room' });
        // click on next button
        await functions.submit();
        // go to message_list
        await page.click(pageobject.Msglist);
        // Click on add message link
        await page.click(pageobject.AddMsg);
        // input message content on input box
        await page.fill(pageobject.inputcontent, 'Hi Testing message');
        // select room for chating
        await page.locator('#inputroom').selectOption({ label: 'Room1' }, { force: true });
        await page.waitForTimeout(1000);
        // submit the message
        await functions.submit();

        await page.fill(pageobject.inputcontent, 'Hi Testing Chatroom');
        await page.locator('#inputroom').selectOption({ label: 'Room2' }, { force: true });

        await page.fill(pageobject.inputcontent, 'Hi Testing again');
        await page.locator('#inputroom').selectOption({ label: 'Room1' }, { force: true });
    });
}); 