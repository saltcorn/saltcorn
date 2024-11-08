const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');
const customAssert = require('../pageobject/utils.js');
const Logger = require('../pageobject/logger.js');

// Test suite for End-to-End testing
test.describe('E2E Test Suite', () => {
    let functions;
    let pageobject;
    let context;
    let page;

    // Setup before all tests
    test.beforeAll(async ({ browser }) => {
        // Initialize the logger
        Logger.initialize();

        // Create a new browser context and page
        context = await browser.newContext({ ignoreHTTPSErrors: true });
        page = await context.newPage();

        // Maximize viewport for better visibility
        await page.setViewportSize({ width: 1350, height: 720 });

        // Initialize page functions and locators
        functions = new PageFunctions(page);
        pageobject = new PageObject(page);

        // Navigate to base URL and perform login
        await functions.navigate_To_Base_URL(baseURL, derivedURL);
        await functions.login('myproject19july@mailinator.com', 'myproject19july');
        await functions.submit();
    });

    // Teardown after all tests
    test.afterAll(async () => {
        // Close page and context
        await page.close();
        await context.close();
    });
      
    // Test to verify the "Event" section presence and URL validation
    test('Verify Files Setting and check "Tab" section', async () => {
        // Clear existing data and navigate to settings page
        await functions.clear_Data();
        await functions.SALTCORN(); // Custom operation in functions
        await functions.navigate_To_Settings();
        await functions.navigate_To_File();

        // Assert "Files" label and the URL
        await customAssert('Assert the label of Files setting', async () => {
            await expect(page.locator(pageobject.File)).toHaveText('Files');
        });
        await page.waitForTimeout(2000);
        await customAssert('Page URL should be /files?sortBy=filename', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'files?sortBy=filename');
        });
    });

    // Test to validate the "Files" tab and its elements
    test('Validate "Files" tab and its elements', async () => {
        // Navigate to the Files tab and validate its elements
        await functions.Files_to_Files();

        // Assertions for various elements in the "Files" tab
        await customAssert('Assert the label of Files tab', async () => {
            await expect(page.locator(pageobject.fileslocator)).toHaveText('Files');
        });
        await page.waitForTimeout(2000);
        await customAssert('Page URL should be /files?sortBy=filename', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'files?sortBy=filename');
        });
        await customAssert('Assert the breadcrumb on Files tab', async () => {
            await expect(page.locator(pageobject.breadcrumbSvgLocator)).toBeVisible();
        });
        await customAssert('Assert the search input on Files tab', async () => {
            await expect(page.locator(pageobject.searchInputLocator)).toBeVisible();
        });
        await customAssert('Assert the file name field on Files tab', async () => {
            await expect(page.locator(pageobject.filenameLocator)).toBeVisible();
        });
        await customAssert('Assert the media type field on Files tab', async () => {
            await expect(page.locator(pageobject.mediaTypeLocator)).toBeVisible();
        });
        await customAssert('Assert the size column on Files tab', async () => {
            await expect(page.locator(pageobject.sizeColumnLocator)).toBeVisible();
        });
        await customAssert('Assert the role-to-access column on Files tab', async () => {
            await expect(page.locator(pageobject.roleToAccessColumnLocator)).toBeVisible();
        });
        await customAssert('Assert the Create New Folder option on Files tab', async () => {
            await expect(page.locator(pageobject.createNewFolder)).toHaveText('Create new folder...');
        });
        await customAssert('Assert the file input on Files tab', async () => {
            await expect(page.locator(pageobject.fileInputLocator)).toBeVisible();
        });
    });

    // Test to validate the "Storage" tab and its elements
    test('Validate "Storage" tab and its elements', async () => {
        // Navigate to the Storage tab and validate its elements
        await functions.Files_to_Storage();

        // Assertions for various elements in the "Storage" tab
        await customAssert('Assert the label of Storage tab', async () => {
            await expect(page.locator(pageobject.storagelocator)).toHaveText('Storage');
        });
        await customAssert('Page URL should be /files/storage', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'files' + derivedURL + 'storage');
        });
        await customAssert('Assert the label of Storage Settings header', async () => {
            await expect(page.locator(pageobject.PageHeader)).toHaveText('Storage settings');
        });

        // Assert Amazon S3 checkbox and input fields
        await customAssert('Assert the Use Amazon S3 checkbox is not checked', async () => {
            await expect(page.locator(pageobject.s3EnabledCheckbox)).not.toBeChecked();
        });
        await customAssert('Assert the Amazon S3 Bucket input field', async () => {
            await expect(page.locator(pageobject.s3BucketInput)).toHaveValue('');
        });
        await customAssert('Assert the Amazon S3 path input field', async () => {
            await expect(page.locator(pageobject.s3PathPrefixInput)).toHaveValue('');
        });
        await customAssert('Assert the Amazon S3 End point input', async () => {
            await expect(page.locator(pageobject.s3EndpointInput)).toHaveValue('s3.amazonaws.com');
        });
        await customAssert('Assert the Amazon S3 Region input', async () => {
            await expect(page.locator(pageobject.s3RegionInput)).toHaveValue('us-east-1');
        });
        await customAssert('Assert the Amazon S3 Access Key input', async () => {
            await expect(page.locator(pageobject.s3AccessKeyInput)).toHaveValue('');
        });
        await customAssert('Assert the Amazon S3 Secret Access Key input', async () => {
            await expect(page.locator(pageobject.s3AccessSecretInput)).toHaveValue('');
        });
        await customAssert('Assert the "Use Amazon S3 Secure" checkbox is checked', async () => {
            await expect(page.locator(pageobject.s3SecureCheckbox)).toBeChecked();
        });
    });

    // Test to validate the "Settings" tab and its elements
    test('Validate "Settings" tab and its elements', async () => {
        // Navigate to the Settings tab and validate its elements
        await functions.Files_to_Settings();

        // Assertions for various elements in the "Settings" tab
        await customAssert('Assert the label of Settings tab', async () => {
            await expect(page.locator(pageobject.Filesettinglocator)).toHaveText('Settings');
        });
        await customAssert('Page URL should be /files/settings', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'files' + derivedURL + 'settings');
        });

        await customAssert('Assert the label of Files Settings header', async () => {
            await expect(page.locator(pageobject.PageHeader)).toHaveText('Files settings');
        });
        await customAssert('Assert the Role id to Upload Files textbox', async () => {
            await expect(page.locator(pageobject.minRoleUploadSelect)).toHaveValue('80');
        });
        await customAssert('Assert the Default File Accept Filter textbox', async () => {
            await expect(page.locator(pageobject.fileAcceptFilterInput)).toHaveValue('');
        });
        await customAssert('Assert the Files Cache TTL (minutes)', async () => {
            await expect(page.locator(pageobject.filesCacheMaxAgeInput)).toHaveValue('86400');
        });
        await customAssert('Assert the File Upload Debug checkbox is not checked', async () => {
            await expect(page.locator(pageobject.fileUploadDebugCheckbox)).not.toBeChecked();
        });
        await customAssert('Assert the File Upload Limit Input textbox', async () => {
            await expect(page.locator(pageobject.fileUploadLimitInput)).toHaveValue('');
        });
        await customAssert('Assert the File Upload Timeout input textbox', async () => {
            await expect(page.locator(pageobject.fileUploadTimeoutInput)).toHaveValue('0');
        });
    });
});
