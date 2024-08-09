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

        // Generate a random string for all tests
        randomString = PageFunctions.generate_Random_String(5);
    });

    test.beforeEach(async ({ browser }) => {
        // Create a new context and page for each test
        context = await browser.newContext();
        page = await context.newPage();
    
        // Maximize the screen
        await page.setViewportSize({ width: 1350, height: 1080 });
    
        functions = new PageFunctions(page);
        pageobject = new PageObject(page);
    
        // Navigate to base URL and perform login
        await functions.navigate_To_Base_URL(baseURL, derivedURL);
        await functions.login('myproject19july@mailinator.com', 'myproject19july');
        await functions.submit();
      });
    
      test.afterEach(async () => {
        // Close the page and context after each test
        await page.close();
        await context.close();
      });

    // Create a new user
    test('Create new user by visiting "Users and Security" tabs', async () => {
        functions = new PageFunctions(page);
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
        // input DOB for user
        await functions.fill_Text(pageobject.inputdob, '09-08-1997');
        // input email address with random name
        await functions.fill_Text(pageobject.inputemail, randomString + '@mailinator.com');
        // select user role
        await page.click(pageobject.inputrole_id);
        await page.keyboard.press('Enter');
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
        // Navigate to setting
        await functions.navigate_To_Settings();
        // Navigate to Users and Security
        await functions.navigate_To_Users_And_Security();
        // search with username as created earlier
        await functions.fill_Text(pageobject.searchbar, randomString);
        await page.keyboard.press('Enter');
        // assert new user is visible
        await customAssert('new user should be visible', async () => {
            await expect(page.getByRole('link', { name: randomString + '@mailinator.com' })).toBeVisible();
        });
    });

    // Delete new user from users tab
    test('Delete new user from users tabs', async () => {
        // Navigate to setting
        await functions.navigate_To_Settings();
        // Navigate to Users and Security
        await functions.navigate_To_Users_And_Security();
        // search with username as created earlier
        await functions.fill_Text(pageobject.searchbar, randomString);
        // Wait for and click the last dropdown menu button
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
            await page.keyboard.press('ArrowDown');
        });

        await customAssert('Delete button should be visible', async () => {
        await functions.clickDeleteButton();
        });
    });

    // Assert the each element of "Users and Security" tab
    test('Validate "Users and Security" tabs', async () => {
        functions = new PageFunctions(page);
        await functions.SALTCORN();
        // Navigate to setting
        await functions.navigate_To_Settings();
        // Navigate to Users and Security
        await functions.navigate_To_Users_And_Security();
        await customAssert('Assert the lable of Users and security setting', async () => {
            await expect(page.locator(pageobject.UsersAndSecurity)).toHaveText('Users and security');
        });
        // assert the user and security url
        await customAssert('page url should be /useradmin', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'useradmin');
        });
        // validate each tab of users and security and assert urls
        await functions.Users_And_Security_to_Users();
        await customAssert('Assert the lable of Users tab', async () => {
            await expect(page.locator(pageobject.userslocator)).toHaveText('Users');
        });
        await customAssert('page url should be /useradmin', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'useradmin');
        });
        await functions.Users_And_Security_to_Roles();
        await customAssert('Assert the lable of Roles tab', async () => {
            await expect(page.locator(pageobject.roleslocator)).toHaveText('Roles');
        });
        await customAssert('page url should be /roleadmin', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'roleadmin');
        });
        await functions.Users_And_Security_to_Login_and_Signup();
        await customAssert('Assert the lable of Login and Signup tab', async () => {
            await expect(page.locator(pageobject.loginandsignup)).toHaveText('Login and Signup');
        });
        await customAssert('page url should be /useradmin/settings', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'useradmin' + derivedURL + 'settings');
        });
        await functions.Users_And_Security_to_Table_access();
        await customAssert('Assert the lable of Table access tab', async () => {
            await expect(page.locator(pageobject.tableaccess)).toHaveText('Table access');
        });
        await customAssert('page url should be /useradmin/table-access', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'useradmin' + derivedURL + 'table-access');
        });
        await functions.Users_And_Security_to_HTTP();
        await customAssert('Assert the lable of HTTP tab', async () => {
            await expect(page.locator(pageobject.httplocator)).toHaveText('HTTP');
        });
        await customAssert('page url should be /useradmin/http', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'useradmin' + derivedURL + 'http');
        });
        await functions.Users_And_Security_to_Permissions();
        await customAssert('Assert the lable of Permissions tab', async () => {
            await expect(page.locator(pageobject.permissionslocator)).toHaveText('Permissions');
        });
        await customAssert('page url should be /useradmin/permissions', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'useradmin' + derivedURL + 'permissions');
        });
    });
});