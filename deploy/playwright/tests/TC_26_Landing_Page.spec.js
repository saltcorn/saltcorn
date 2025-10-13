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
    await page.setViewportSize({ width: 1500, height: 720 });

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

  //Create Subscription Plan table
  test('Create Subscription Plan table', async () => {
    await functions.clear_Data();
    // click table button
    await functions.click_table();
    // Click the "Create table" button
    await page.click(pageobject.createtablebutton);
    // Enter Table name
    await functions.fill_Text(pageobject.InputName, 'Subscription_Plan');
    // click on Create button
    await page.click(pageobject.submitButton);
    await page.click(pageobject.addFieldButtonLocator);
    // Fill the lable name
    await functions.fill_Text(pageobject.labelTextboxlocator, 'Plan Name');
    // select the input type
    const type = await page.$("#inputtype");
    await type?.selectOption("String");
    // Fill the discription
    await functions.fill_Text(pageobject.descriptionSelector, 'Name of Subscription Plan');
    // select the required check box
    await page.waitForSelector(pageobject.RequiredcheckboxLocator);
    await page.check(pageobject.RequiredcheckboxLocator);
    // Click on next button
    await functions.submit();
    await functions.submit();
    await functions.submit();
  });

  //Add Price field
  test('Add Price field', async () => {
    // Install money module for price
    await functions.install_money();
    // click table button
    await functions.click_table();
    await page.click(pageobject.Subs_Plantable);
    await page.click(pageobject.addFieldButtonLocator);
    // Fill the lable name
    await functions.fill_Text(pageobject.labelTextboxlocator, 'Price');
    // select the input type
    const type = await page.$("#inputtype");
    await type?.selectOption("Money");
    // Fill the discription
    await functions.fill_Text(pageobject.descriptionSelector, 'Price of Subscription Plan');
    // Click on next button
    await functions.submit();
    // Input currency type
    await functions.fill_Text(pageobject.inputcurrency, 'USD');
    // Click on Next button
    await functions.submit();
  });

  //Add Feature field
  test('Add Feature field', async () => {
    // Install money module for price
    await functions.install_ckeditor();
    // click table button
    await functions.click_table();
    await page.click(pageobject.Subs_Plantable);
    await page.click(pageobject.addFieldButtonLocator);
    // Fill the lable name
    await functions.fill_Text(pageobject.labelTextboxlocator, 'Features');
    // select the input type
    const type = await page.$("#inputtype");
    await type?.selectOption("HTML");
    // Fill the discription
    await functions.fill_Text(pageobject.descriptionSelector, 'Featurs of Subscription Plan');
    // Submit the page
    await functions.submit();
    await functions.submit();
  });

  //Add cta_link and icon field
  test('Add cta_link and icon field', async () => {
    // click table button
    await functions.click_table();
    await page.click(pageobject.Subs_Plantable);
    // Add cta_link field
    await page.click(pageobject.addFieldButtonLocator);
    // Fill the lable name
    await functions.fill_Text(pageobject.labelTextboxlocator, 'cta_link');
    // select the input type
    const type = await page.$("#inputtype");
    await type?.selectOption("String");
    // Fill the discription
    await functions.fill_Text(pageobject.descriptionSelector, 'Call to Action link of Subscription Plan');
    // Submit the page
    await functions.submit();
    await functions.submit();

    // Add icon field
    await page.click(pageobject.addFieldButtonLocator);
    // Fill the lable name
    await functions.fill_Text(pageobject.labelTextboxlocator, 'Icon');
    // select the input type
    const type1 = await page.$("#inputtype");
    await type1?.selectOption("File");
    // Fill the discription
    await functions.fill_Text(pageobject.descriptionSelector, 'Icon for Subscription Plan');
    // Submit the page
    await functions.submit();
    await functions.fill_Text(pageobject.inputfilestype, 'image/*');
    await functions.submit();
  });

  //Create Edit_Plan view with edit view pattern
  test('Create Edit_Plan view with edit view pattern', async () => {
    await functions.views();
    // click on create new view
    await page.click(pageobject.createnewview);
    // input view name and discription
    await page.fill(pageobject.InputName, 'Edit_Plan');
    await page.fill(pageobject.discriptiontext, 'Add subscription Plan');
    // select the Edit pattern
    const EditPattern = await page.$("#inputviewtemplate");
    await EditPattern?.selectOption("Edit");
    // submit the page
    await functions.submit();
    // drag and drop the page source on the page
    // await page.waitForTimeout(1000);
    await page.click(pageobject.inputfeatures);
    await page.selectOption(pageobject.fieldViewdropdown, { label: 'CKEditor4' });
    // click on next page
    await page.waitForSelector(pageobject.nextoption);
    await page.click(pageobject.nextoption);
    // click on finish button
    await functions.submit();
  });

  //Create list view For Subscription Plans
  test('Create list view For Subscription Plans', async () => {
    await functions.views();
    // click on create new view
    await page.click(pageobject.createnewview);
    // input view name and discription
    await page.fill(pageobject.InputName, 'Plan_List');
    await page.fill(pageobject.discriptiontext, 'List of Subscription Plans');
    // select list pattern
    const ListPattern = await page.$("#inputviewtemplate");
    await ListPattern?.selectOption("List");
    // submit the page
    await functions.submit();
    // await page.waitForTimeout(1000);
    await page.click('text="[Link icon]"');
    // Select 'Thumbnail' from the dropdown
    await page.selectOption(pageobject.fieldViewdropdown, { label: 'Thumbnail' }); // If using a select dropdown
    // Add new column for edit plan link
    await page.click(pageobject.addcolumnbutton);
    // drag and drop the action view link
    await functions.drag_And_Drop(pageobject.viewlinksource, pageobject.newcolumn);
    // add lable for link
    await functions.fill_Text(pageobject.lebelforfield, 'Edit Plan');
    // click on again new column button on page
    await page.click(pageobject.addcolumnbutton);
    // drag and drop the action locator for delete button
    await functions.drag_And_Drop(pageobject.ActionLocator, pageobject.newcolumn);
    // click on next button
    await page.click(pageobject.nextoption);
    await page.click(pageobject.viewtocreate);
    const viewtocreate = await page.$("#inputview_to_create");
    await viewtocreate?.selectOption("Edit_Plan [Edit]");
    // add lable for view to create
    await functions.fill_Text(pageobject.labeltocreate, 'Add New Plan');
    // click on next button
    await functions.submit();
    // click on next button
    await functions.submit();
    await functions.submit();

    // Add Plan_List view as Destination view for Edit_Plan view
    await page.click(pageobject.configureEditPlan);
    await page.click(pageobject.nextoption);
    // select destination view
    await page.click(pageobject.destinationview);
    await page.selectOption(pageobject.destinationview, { label: 'Plan_List [List on Subscription_Plan]' });
    // Finish the page
    await functions.submit();
  });

  //Add Subscription plans from view
  test('Add Subscription plans from view', async () => {
    await functions.views();
    await page.click(pageobject.PlanListlink);
    await page.click(pageobject.addplanlink);
    await functions.fill_Text(pageobject.inputplan_name, 'Basic Plan');
    await functions.fill_Text(pageobject.inputprice, '9.99');
    await functions.fill_Text(pageobject.inputcta_link, '/subscribe/basic');
    // Add Feature in iframe
    await page.waitForSelector('iframe');
    // Wait for the iframe to be available
    const frame = page.frameLocator('iframe');
    // Wait for the body inside the iframe to be available
    await frame.locator('body').waitFor();
    // Optionally, ensure the body is visible before filling it
    await frame.locator('body').waitFor({ state: 'visible' });
    // Fill the content inside the iframe
    await frame.locator('body').click(); // Ensure the body is focused
    // make text bold
    await page.click('#cke_12');
    await frame.locator('body').type('Access to free content\nCommunity support\nLimited resources');
    // Wait for the file input element to be available
    const fileInput = await page.waitForSelector('input[type="file"]');
    // Set the file input to the desired file
    const filePath = 'Csv_file_to_uplaod/basic.png'; // Replace with the correct path to your png file
    await fileInput.setInputFiles(filePath);
    // Click on create button
    await functions.submit();

    await page.click(pageobject.addplanlink);
    await functions.fill_Text(pageobject.inputplan_name, 'Pro Plan');
    await functions.fill_Text(pageobject.inputprice, '19.99');
    await functions.fill_Text(pageobject.inputcta_link, '/subscribe/Pro');
    // Add Feature in iframe
    await page.waitForSelector('iframe');
    // Wait for the iframe to be available
    const frame1 = page.frameLocator('iframe');
    // Wait for the body inside the iframe to be available
    await frame1.locator('body').waitFor();
    // Optionally, ensure the body is visible before filling it
    await frame1.locator('body').waitFor({ state: 'visible' });
    // Fill the content inside the iframe
    await frame1.locator('body').click(); // Ensure the body is focused
    // make text bold
    await page.click('#cke_12');
    await frame1.locator('body').type('Everything in Basic\nExclusive content\nPriority support');
    // Wait for the file input element to be available
    const fileInput1 = await page.waitForSelector('input[type="file"]');
    // Set the file input to the desired file
    const filePath1 = 'Csv_file_to_uplaod/pro.jpg'; // Replace with the correct path to your png file
    await fileInput1.setInputFiles(filePath1);
    // Click on create button
    await functions.submit();

    await page.click(pageobject.addplanlink);
    await functions.fill_Text(pageobject.inputplan_name, 'Premium Plan');
    await functions.fill_Text(pageobject.inputprice, '29.99');
    await functions.fill_Text(pageobject.inputcta_link, '/subscribe/Premium');
    // Add Feature in iframe
    await page.waitForSelector('iframe');
    // Wait for the iframe to be available
    const frame2 = page.frameLocator('iframe');
    // Wait for the body inside the iframe to be available
    await frame2.locator('body').waitFor();
    // Optionally, ensure the body is visible before filling it
    await frame2.locator('body').waitFor({ state: 'visible' });
    // Fill the content inside the iframe
    await frame2.locator('body').click(); // Ensure the body is focused
    // make text bold
    await page.click('#cke_12');
    await frame2.locator('body').type('Everything in Basic\nExclusive content\nPriority support');
    // Wait for the file input element to be available
    const fileInput2 = await page.waitForSelector('input[type="file"]');
    // Set the file input to the desired file
    const filePath2 = 'Csv_file_to_uplaod/Premium.jpg'; // Replace with the correct path to your png file
    await fileInput2.setInputFiles(filePath2);
    // Click on create button
    await functions.submit();
  });

  test('Create a landing Page for Subscription Plans', async () => {
    // Create a new page for landing page
    await functions.create_New_Page('Landing_Page');
    // await page.waitForTimeout(1000);
    // Drag and drop the text source
    await page.waitForSelector(pageobject.htmlCodeSource);
    await functions.drag_And_Drop(pageobject.htmlCodeSource, pageobject.target);
    // await page.waitForTimeout(1000);
    await functions.fill_Text(pageobject.htmltextlocator, `
      <div style="text-align: center; padding: 50px; background: linear-gradient(135deg, #6a11cb, #2575fc); color: white; border-radius: 10px;">
        <h1 style="font-size: 2.5em;">🚀 Welcome to Our Premium Plans!</h1>
        <p style="font-size: 1.2em;">Unlock exclusive features & elevate your experience. Choose the perfect plan and enjoy premium benefits!</p>
        <a href="#plans" style="background-color: #ffcc00; color: #000; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block; margin-top: 15px;">
          Explore Plans
        </a>
      </div>
    `);
    await functions.drag_And_Drop(pageobject.columnsElement, pageobject.target);
    await functions.fill_Text(pageobject.numbercolumn, '4');

    await functions.drag_And_Drop(pageobject.htmlCodeSource, pageobject.column1_3);
    await functions.fill_Text(pageobject.htmltextlocator, `
    <div style="background-color: #d1ecf1; border: 2px solid #17a2b8; border-radius: 15px; padding: 20px; width: 320px; text-align: center; box-shadow: 2px 2px 10px rgba(0,0,0,0.1); transition: transform 0.3s ease-in-out;" 
     onmouseover="this.style.transform='scale(1.1)'" 
     onmouseout="this.style.transform='scale(1)'">
        <h3 style="color: #0c5460; font-size: 22px; font-weight: bold; margin-bottom: 10px;">Pro Plan</h3>
        <p style="color: #0c5460; font-size: 20px; font-weight: bold;">₹499 / month</p>
        
        <ul style="list-style: none; padding: 0; margin: 15px 0; color: #0c5460; text-align: left;">
            <li>✔ 50GB Storage</li>
            <li>✔ Priority Support</li>
            <li>✔ Access to Exclusive Content</li>
            <li>✔ Free Custom Domain</li>
            <li style="color: red;">❌ Advanced Analytics & Reports</li>
        </ul>
        <a href="/page/Payment_Page?plan=Pro&amount=499" style="text-decoration: none;">
        <button style="background-color: #0056b3; color: white; font-size: 16px; font-weight: bold; padding: 10px 20px; border: none; border-radius: 25px; cursor: pointer; box-shadow: 1px 1px 5px rgba(0,0,0,0.2);">Subscribe</button>
        </a>
    </div>
`);

    await functions.drag_And_Drop(pageobject.htmlCodeSource, pageobject.column1_2);
    await functions.fill_Text(pageobject.htmltextlocator, `
      <div style="background-color: #d4edda; border: 2px solid #28a745; border-radius: 15px; padding: 20px; width: 320px; text-align: center; box-shadow: 2px 2px 10px rgba(0,0,0,0.1); transition: transform 0.3s ease-in-out;" 
     onmouseover="this.style.transform='scale(1.1)'" 
     onmouseout="this.style.transform='scale(1)'"> 
          <h3 style="color: #155724; font-size: 22px; font-weight: bold; margin-bottom: 10px;">Basic Plan</h3>
          <p style="color: #155724; font-size: 20px; font-weight: bold;">₹199 / month</p>
          
          <ul style="list-style: none; padding: 0; margin: 15px 0; color: #155724; text-align: left;">
              <li>✔ 10GB Storage</li>
              <li>✔ Basic Support</li>
              <li>✔ Access to Community</li>
              <li style="color: red;">❌ Free Custom Domain & Hosting</li>
              <li style="color: red;">❌ Advanced Analytics & Reports</li>
          </ul>
          <a href="/page/Payment_Page?plan=Basic&amount=199" style="text-decoration: none;">
          <button style="background-color: #218838; color: white; font-size: 16px; font-weight: bold; padding: 10px 20px; border: none; border-radius: 25px; cursor: pointer; box-shadow: 1px 1px 5px rgba(0,0,0,0.2);">Subscribe</button>
          </a>
      </div>
  `);

    await functions.drag_And_Drop(pageobject.htmlCodeSource, pageobject.column1_4);
    await functions.fill_Text(pageobject.htmltextlocator, `
  <div style="background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 15px; padding: 20px; width: 320px; text-align: center; box-shadow: 2px 2px 10px rgba(0,0,0,0.1); transition: transform 0.3s ease-in-out;" 
     onmouseover="this.style.transform='scale(1.1)'" 
     onmouseout="this.style.transform='scale(1)'">
      <h3 style="color: #856404; font-size: 22px; font-weight: bold; margin-bottom: 10px;">Premium Plan</h3>
      <p style="color: #856404; font-size: 20px; font-weight: bold;">₹999 / month</p>
      
      <ul style="list-style: none; padding: 0; margin: 15px 0; color: #856404; text-align: left;">
          <li>✔ 100GB Storage</li>
          <li>✔ 24/7 Priority Support</li>
          <li>✔ Access to All Exclusive Content</li>
          <li>✔ Free Custom Domain & Hosting</li>
          <li>✔ Advanced Analytics & Reports</li>
      </ul>
      <a href="/page/Payment_Page?plan=Premium&amount=999" style="text-decoration: none;">
      <button style="background-color: #d39e00; color: white; font-size: 16px; font-weight: bold; padding: 10px 20px; border: none; border-radius: 25px; cursor: pointer; box-shadow: 1px 1px 5px rgba(0,0,0,0.2);">Subscribe</button>
      </a>
  </div>
`);
    await functions.drag_And_Drop(pageobject.htmlCodeSource, pageobject.column1);
    await functions.fill_Text(pageobject.htmltextlocator, `
      <div style="background-color: #e3f2fd; border: 2px solid #2196f3; border-radius: 15px; padding: 20px; width: 320px; text-align: center; box-shadow: 2px 2px 10px rgba(0,0,0,0.1); transition: transform 0.3s ease-in-out;"
     onmouseover="this.style.transform='scale(1.1)'" 
     onmouseout="this.style.transform='scale(1)'">
          <h3 style="color: #0d47a1; font-size: 22px; font-weight: bold; margin-bottom: 10px;">Free Plan</h3>
          <p style="color: #0d47a1; font-size: 20px; font-weight: bold;">₹0 / month</p>
          
          <ul style="list-style: none; padding: 0; margin: 15px 0; color: #0d47a1; text-align: left;">
              <li>✔ 5GB Storage</li>
              <li>✔ Limited Access to Features</li>
              <li style="color: red;">❌ No Custom Domain & Hosting</li>
              <li style="color: red;">❌ No Advanced Analytics & Reports</li>
              <li style="color: red;">❌ No Priority Support</li>
          </ul>
  
          <button style="background-color: #1976d2; color: white; font-size: 16px; font-weight: bold; padding: 10px 20px; border: none; border-radius: 25px; cursor: pointer; box-shadow: 1px 1px 5px rgba(0,0,0,0.2);">Get Started</button>
      </div>
  `);
    await functions.Save_Page_Project();
  });

  test('Create a Payment page for subscription', async () => {
    // Create a new page for landing page
    await functions.create_New_Page('Payment_Page');
    // await page.waitForTimeout(5000);
    // Drag and drop the htmlCodeSource
    await page.waitForSelector(pageobject.htmlCodeSource);
    await functions.drag_And_Drop(pageobject.htmlCodeSource, pageobject.target);
    await functions.fill_Text(pageobject.htmltextlocator, `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0px 5px 15px rgba(0, 0, 0, 0.2); width: 600px; text-align: center;">
        <h2 style="color: #333; margin-bottom: 20px;">Saltcorn Secure Payment</h2>

        <form style="width: 100%;" onsubmit="event.preventDefault(); window.location.href='/page/Thank_you';">
            <!-- Cardholder Name -->
            <div style="display: flex; flex-direction: column; margin-bottom: 15px; text-align: left;">
                <label for="cardholder-name" style="font-weight: bold; margin-bottom: 5px;">Cardholder Name</label>
                <input type="text" id="cardholder-name" name="cardholder_name" placeholder="Card Holder Name"
                    style="width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 5px; font-size: 16px;" required>
            </div>

            <!-- Card Number -->
            <div style="display: flex; flex-direction: column; margin-bottom: 15px; text-align: left;">
                <label for="card-number" style="font-weight: bold; margin-bottom: 5px;">Card Number</label>
                <input type="text" id="card-number" name="card_number" placeholder="1234 5678 9012 3456"
                    style="width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 5px; font-size: 16px;" required>
            </div>

            <!-- Expiry Date & CVV -->
            <div style="display: flex; gap: 15px; margin-bottom: 15px; text-align: left;">
                <!-- Expiry Date -->
                <div style="display: flex; flex-direction: column; width: 50%;">
                    <label for="expiry-date" style="font-weight: bold; margin-bottom: 5px;">Expiry Date</label>
                    <input type="text" id="expiry-date" name="expiry_date" placeholder="MM/YY"
                        style="width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 5px; font-size: 16px;" required>
                </div>

                <!-- CVV -->
                <div style="display: flex; flex-direction: column; width: 50%;">
                    <label for="cvv" style="font-weight: bold; margin-bottom: 5px;">CVV</label>
                    <input type="password" id="cvv" name="cvv" placeholder="123"
                        style="width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 5px; font-size: 16px;" required>
                </div>
            </div>

            <button type="submit" style="background: #007bff; color: white; padding: 15px; width: 100%; border: none; border-radius: 5px; font-size: 18px; cursor: pointer; margin-top: 15px;">
                Proceed to Pay
            </button>
        </form>
    </div>
</div>
  `);
    await functions.Save_Page_Project();
  });

  test('Create thank you page after payment', async () => {
    // Create a new page for thank you
    await functions.create_New_Page('Thank_you');
    // await page.waitForTimeout(1000);
    // Drag and drop the text source
    await page.waitForSelector(pageobject.htmlCodeSource);
    await functions.drag_And_Drop(pageobject.htmlCodeSource, pageobject.target);
    await functions.fill_Text(pageobject.htmltextlocator, `
      <div style="display: flex; justify-content: center; align-items: flex-start; height: 100vh; background-color: #f4f4f4; font-family: Arial, sans-serif;">
          <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0px 5px 15px rgba(0, 0, 0, 0.2); width: 600px; text-align: center;">
              <h2 style="color: #28a745; font-size: 24px; margin-bottom: 10px;">Thank You for Your Payment!</h2>
              <p style="color: #555; font-size: 18px; margin-bottom: 20px;">Your transaction is Processing... A confirmation email will be sent to your email address.</p>
              <a href="/page/Landing_Page" style="background: #007bff; color: white; padding: 12px 20px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; text-decoration: none; display: inline-block;">
                  Back to Home
              </a>
          </div>
      </div>
  `);
    await functions.Save_Page_Project();
  });

  test('Test the landing Page, Payment page and thankyou page', async () => {
    // test the landing page
    await page.click(pageobject.newPage_sidebar);
    await page.click(pageobject.LandingPage);
    await customAssert('Subscribe button on plan card should be visible and clickable', async () => {
      // click on subscribe button
      await page.click(pageobject.SubscribeButton);
      // await page.waitForTimeout(1000);
    });
    console.log(await page.url());
    // enter details
    await customAssert('Enter card details for payment', async () => {
      await functions.fill_Text(pageobject.CardholderNameInput, 'john doe');
      await functions.fill_Text(pageobject.CardNumberInput, '4111111111111111');
      await functions.fill_Text(pageobject.Exdateinput, '10/36');
      await functions.fill_Text(pageobject.CVVinput, '926');
    });
    await customAssert('Proceed button on payment page should be visible and clickable', async () => {
      await expect(page.locator(pageobject.ProceedToPayButton)).toBeVisible();
      // click to proceed button
      await page.click(pageobject.ProceedToPayButton);
    });
    // click on back to home button
    await page.click(pageobject.LandingPage);
  });
});