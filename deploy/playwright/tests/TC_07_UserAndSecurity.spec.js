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
        // Create a new context and page for all tests
        context = await browser.newContext({
            ignoreHTTPSErrors: true
        });
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
        // Clear data before test executions
        await functions.clear_Data();
    });

    test.afterAll(async () => {
        // Close the page and context after all test
        await page.close();
        await context.close();
    });

    // Create a new user
    test('Create new user by visiting "Users and Security" tabs', async () => {
        functions = new PageFunctions(page);
        await functions.SALTCORN();
        // Navigate to setting
        await functions.navigate_To_Settings();
        // Navigate to Users and Security
        await functions.navigate_To_Users_And_Security();
        // assert the user and security url
        await customAssert('page url should be /useradmin', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'useradmin');
        });
        // validate each tab of users and security and assert urls
        await functions.Users_And_Security_to_Users();
        //  Create user button should be visible and working
        await customAssert('Create user button is visible and working', async () => {
            await expect(page.locator(pageobject.createuserlink)).toBeVisible();
            await page.click(pageobject.createuserlink);
        });
        // assert the page url for new user
        await customAssert('page url should be /useradmin/new', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'useradmin' + derivedURL + 'new');
        });
        // input email address with random name
        await functions.fill_Text(pageobject.inputemail, randomString + '@mailinator.com');
        // select user role
        await page.click(pageobject.inputrole_id);
        // uncheck random password checkbox
        await page.click(pageobject.inputrnd_password);
        // enter password on password field
        await functions.fill_Text(pageobject.inputpassword, 'Pass@123');
        // click on create user button
        await page.click(pageobject.createuserbutton);
    });

    // Search new user on users tab
    test('Search new user from Users tabs', async () => {
        functions = new PageFunctions(page);
        // search with username as created earlier
        await functions.fill_Text(pageobject.searchbar, randomString);
        // assert new user is visible
        await customAssert('new user should be visible', async () => {
            await expect(page.getByRole('link', { name: randomString + '@mailinator.com' })).toBeVisible();
        });
    });

    // Delete new user from users tab
    test('Delete new user from users tabs', async () => {
        // click the last dropdown menu button
        await customAssert('dropdown menu should be visible', async () => {
            const elements = await page.locator('[id^="dropdownMenuButton"]');
            const count = await elements.count();
            if (count === 0) {
                throw new Error('No elements found for selector: [id^="dropdownMenuButton"]');
            }
            const lastDropdownButton = elements.nth(count - 1);
            await lastDropdownButton.scrollIntoViewIfNeeded();
            await expect(lastDropdownButton).toBeVisible();
            await lastDropdownButton.click();
        });
        
        // Assert the visibility of Delete button 
        await customAssert('Delete button should be visible', async () => {
            await functions.clickDeleteButton();
        });
    });

    // Assert the Roles tab and its element in "Users and Security" setting
    test('Validate "Roles" tab', async () => {
        await functions.SALTCORN();
        // Navigate to setting
        await functions.navigate_To_Settings();
        // Navigate to Users and Security
        await functions.navigate_To_Users_And_Security();
        // validate Roles tab of users and security and assert urls
        await functions.Users_And_Security_to_Roles();
        await customAssert('Assert the lable of Roles tab', async () => {
            await expect(page.locator(pageobject.roleslocator)).toHaveText('Roles');
        });
        await customAssert('page url should be /roleadmin', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'roleadmin');
        });
        // Assert the visibility of question icon and click
        await customAssert('Assert the question Icon on Roles tab', async () => {
            await expect(page.locator(pageobject.questionIconLocator)).toBeVisible();
            // click on Question icon
            await page.click(pageobject.questionIconLocator);
        });
        // Assert the Help window open when click on question icon
        await customAssert('Assert the Help window open when click on question icon', async () => {
            await expect(page.locator(pageobject.modalTitleLocator)).toHaveText('Help: User roles');
        });
        // Assert and click on close button
        await customAssert('Assert the close button Icon on help window', async () => {
            await expect(page.locator(pageobject.closeButtonLocator)).toBeVisible();
            await page.click(pageobject.closeButtonLocator);
        });
        // Assert the visibility of add new role link
        await customAssert('Assert the visibility of add new role link', async () => {
            await expect(page.locator(pageobject.addnewrole)).toBeVisible();
            await page.click(pageobject.addnewrole);
        });
        // Assert the new role url
        await customAssert('page url should be /roleadmin/new', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'roleadmin/new');
        });
        // Assert the visibility of id number dropdown
        await customAssert('Assert the visibility of id number dropdown', async () => {
            await expect(page.locator(pageobject.idNumberInput)).toBeVisible();
        });
        // Assert the visibility of role name text box
        await customAssert('Assert the visibility of role name text box', async () => {
            await expect(page.locator(pageobject.roleTextInput)).toBeVisible();
        });
        // Assert the visibility of Save button
        await customAssert('Assert the visibility of Save button', async () => {
            await expect(page.locator(pageobject.saveactionbutton)).toBeVisible();
        });
    });

    // Assert the Login and Signin tab and its element in "Users and Security" setting
    test('Validate Login and Signup" tabs', async () => {
        // validate Login and Signup tab of users and security and assert urls
        await functions.Users_And_Security_to_Login_and_Signup();
        await customAssert('Assert the lable of Login and Signup tab', async () => {
            await expect(page.locator(pageobject.loginandsignup)).toHaveText('Login and Signup');
        });
        await customAssert('page url should be /useradmin/settings', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'useradmin' + derivedURL + 'settings');
        });
        // Assert the visibility of allow Signup Checkbox is checked
        await customAssert('Assert the visibility of allow Signup Checkbox is checked', async () => {
            await expect(page.locator(pageobject.allowSignupCheckbox)).toBeChecked();
        });
        // Assert the visibility of login Menu Checkbox and checked
        await customAssert('Assert the visibility of login Menu Checkbox and checked', async () => {
            await expect(page.locator(pageobject.loginMenuCheckbox)).toBeChecked();
        });
        // Assert the visibility of allow Forgot Checkbox not checked
        await customAssert('Assert the visibility of allow Forgot Checkbox not checked', async () => {
            await expect(page.locator(pageobject.allowForgotCheckbox)).not.toBeChecked();
        });
        // Assert the visibility of new User Form Dropdown
        await customAssert('Assert the visibility of new User Form Dropdown', async () => {
            await expect(page.locator(pageobject.newUserFormDropdown)).toHaveValue('');
        });
        // Assert the visibility of login Form Dropdown
        await customAssert('Assert the visibility of login Form Dropdown', async () => {
            await expect(page.locator(pageobject.loginFormDropdown)).toHaveValue('');
        });
        // Assert the visibility of signup Form Dropdown
        await customAssert('Assert the visibility of signup Form Dropdown', async () => {
            await expect(page.locator(pageobject.signupFormDropdown)).toHaveValue('');
        });
        // Assert the visibility of user Settings Form Dropdown
        await customAssert('Assert the visibility of user Settings Form Dropdown', async () => {
            await expect(page.locator(pageobject.userSettingsFormDropdown)).toHaveValue('');
        });
        // Assert the visibility of verification View Dropdown
        await customAssert('Assert the visibility of verification View Dropdown', async () => {
            await expect(page.locator(pageobject.verificationViewDropdown)).toHaveValue('');
        });
        // Assert the visibility of logout Url Textbox
        await customAssert('Assert the visibility of logout Url Textbox', async () => {
            await expect(page.locator(pageobject.logoutUrlTextbox)).toBeVisible();
        });
        // Assert the visibility of signup Role Dropdown
        await customAssert('Assert the visibility of signup Role Dropdown', async () => {
            await expect(page.locator(pageobject.signupRoleDropdown)).toBeVisible();
        });
        // Assert the visibility of elevate Verified Dropdown
        await customAssert('Assert the visibility of elevate Verified Dropdown', async () => {
            await expect(page.locator(pageobject.elevateVerifiedDropdown)).toHaveValue('');
        });
        // Assert the visibility of email Mask Textbox
        await customAssert('Assert the visibility of email Mask Textbox', async () => {
            await expect(page.locator(pageobject.emailMaskTextbox)).toHaveValue('');
        });
    });

    // Assert the Table access tab and its element in "Users and Security" setting
    test('Validate "Table access" tabs', async () => {
        // validate Table access tab of users and security and assert urls
        await functions.Users_And_Security_to_Table_access();
        await customAssert('Assert the lable of Table access tab', async () => {
            await expect(page.locator(pageobject.tableaccess)).toHaveText('Table access');
        });
        await customAssert('page url should be /useradmin/table-access', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'useradmin' + derivedURL + 'table-access');
        });
        // Assert the visibility of ownership Field Dropdown
        await customAssert('Assert the visibility of ownership Field Dropdown', async () => {
            await expect(page.locator(pageobject.ownershipFieldDropdown)).toHaveValue('');
        });
        // Assert the visibility of min Role Read Dropdown
        await customAssert('Assert the visibility of min Role Read Dropdown', async () => {
            await expect(page.locator(pageobject.minRoleReadDropdown)).toHaveValue('1');
        });
        // Assert the visibility of min Role Write Dropdown
        await customAssert('Assert the visibility of min Role Write Dropdown', async () => {
            await expect(page.locator(pageobject.minRoleWriteDropdown)).toHaveValue('1');
        });
    });

    // Assert the HTTP tab and its element in "Users and Security" setting
    test('Validate HTTP" tabs', async () => {
        // validate HTTP tab of users and security and assert urls
        await functions.Users_And_Security_to_HTTP();
        await customAssert('Assert the lable of HTTP tab', async () => {
            await expect(page.locator(pageobject.httplocator)).toHaveText('HTTP');
        });
        await customAssert('page url should be /useradmin/http', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'useradmin' + derivedURL + 'http');
        });
        // Assert the visibility of cookie Duration Textbox
        await customAssert('Assert the visibility of cookie Duration Textbox', async () => {
            await expect(page.locator(pageobject.cookieDurationTextbox)).toHaveValue('720');
        });
        // Assert the visibility of cookie Duration Remember Textbox
        await customAssert('Assert the visibility of cookie Duration Remember Textbox', async () => {
            await expect(page.locator(pageobject.cookieDurationRememberTextbox)).toHaveValue('720');
        });
        // Assert the visibility of public Cache Max age Textbox
        await customAssert('Assert the visibility of public Cache Max age Textbox', async () => {
            await expect(page.locator(pageobject.publicCacheMaxageTextbox)).toHaveValue('0');
        });
        // Assert the visibility of code Mirror Line
        await customAssert('Assert the visibility of code Mirror Line', async () => {
            await expect(page.locator(pageobject.codeMirrorLine)).toBeVisible();
        });
    });

    // Assert the Permission tab and its element in "Users and Security" setting
    test('Validate "Permission" tabs', async () => {
        // validate Permission tab of users and security and assert urls
        await functions.Users_And_Security_to_Permissions();
        await customAssert('Assert the lable of Permissions tab', async () => {
            await expect(page.locator(pageobject.permissionslocator)).toHaveText('Permissions');
        });
        await customAssert('page url should be /useradmin/permissions', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'useradmin' + derivedURL + 'permissions');
        });
        // Assert the visibility of Role to Upload files
        await customAssert('Assert the visibility of Role to Upload files', async () => {
            await expect(page.locator(pageobject.minRoleUploadSelect)).toBeVisible();
        });
        // Assert the visibility of Role to generate Api keys
        await customAssert('Assert the visibility of Role to generate Api keys', async () => {
            await expect(page.locator(pageobject.minRoleApikeygenSelect)).toBeVisible();
        });
        // Assert the visibility of Role for Search
        await customAssert('Assert the visibility of Role for Search', async () => {
            await expect(page.locator(pageobject.minRoleSearchSelect)).toBeVisible();
        });
    });
});