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
    await functions.submit();

    await functions.clear_Data();

  });

  test.afterAll(async () => {
    // Ensure the page and context close properly after tests
    await page.close();
    await context.close();
  });

  test('validate image name', async () => {
    // Create a new page named 'saltcorn_image' and drag-and-drop the image component
    await functions.create_New_Page('saltcorn_image');
    await functions.drag_And_Drop(pageobject.imageSource, pageobject.target);
    await page.waitForTimeout(3000);
    // Verify that 'Image settings' appears on the screen
    await customAssert('Image settings should be visible', async () => {
      await expect(page.getByText('Image settings')).toBeVisible();
    });

    // Select "File", "URL", and "Upload" options for uploading an image
    const uploadOptions = ["File", "URL", "Upload"];
    for (const option of uploadOptions) {
      await page.locator(pageobject.UploadImageSelector).selectOption({ label: option });
    }

    // Handle file upload
    const fileInput = await page.waitForSelector(pageobject.FileInputForUpload);
    const filePath = 'Csv_file_to_uplaod/images.jpg';
    await fileInput.setInputFiles(filePath);
    await page.waitForTimeout(10000);

    // Wait for the save button and click to save the uploaded image
    await page.waitForSelector(pageobject.UploadImageSave, { state: 'visible' });
    await page.click(pageobject.UploadImageSave);

    // Locate and click the newly created "saltcorn_image" page link
    const saltcornImageLink = page.locator(pageobject.CreatedPageName);
    await expect(saltcornImageLink).toBeVisible();
    await saltcornImageLink.click();

    // Validate that the page URL updates to reflect the "saltcorn_image" page
    await expect(page).toHaveURL(/saltcorn_image/);
    // Verify that the uploaded image is present on the new page
    const imageLocator = page.locator(pageobject.ImageLocator);
    await expect(imageLocator).toBeVisible(); // Assert that the image is loaded
    await functions.clear_Data();
  });
});
