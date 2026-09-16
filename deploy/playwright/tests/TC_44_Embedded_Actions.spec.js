const { test, expect } = require("@playwright/test");
const { baseURL, derivedURL } = require("../pageobject/base_url.js");
const PageFunctions = require("../pageobject/function.js");
const PageObject = require("../pageobject/locators.js");
const customAssert = require("../pageobject/utils.js");
const Logger = require("../pageobject/logger.js");

// Regression suite: an embedded action button's <form> used to get dropped
// when nested in another view's own <form>; now it's a plain <a onclick>.
test.describe("E2E Test Suite - Embedded action button inside another view's form", () => {
  let functions;
  let pageobject;
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(60000);
    Logger.initialize();
    context = await browser.newContext({
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();

    functions = new PageFunctions(page);
    pageobject = new PageObject(page);

    await functions.navigate_To_Base_URL(baseURL, derivedURL);
    await functions.login("myproject19july@mailinator.com", "myproject19july");
    await functions.submit();
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
  });

  test("create People table from csv", async () => {
    await functions.clear_Data();
    await functions.click_table();
    await page.click(pageobject.createfromcsvupload);
    const fileInput = await page.waitForSelector('input[type="file"]');
    await fileInput.setInputFiles("Csv_file_to_uplaod/People1.csv");
    await functions.fill_Text(pageobject.InputName, "People");
    await functions.submit();
  });

  test("create inner List view with a Delete action column", async () => {
    await functions.views();
    await page.click(pageobject.createnewview);
    await page.fill(pageobject.InputName, "People_list_inner");
    await page.fill(
      pageobject.discriptiontext,
      "inner list, embedded in People_edit_outer"
    );
    await customAssert("View pattern should be List", async () => {
      const pattern = await page.$("#inputviewtemplate");
      await pattern?.selectOption("List");
    });
    await functions.submit();
    await page.waitForTimeout(1000);
    await page.click(pageobject.addcolumnbutton);
    await customAssert("Drag Action element into the new column", async () => {
      await functions.drag_And_Drop(
        pageobject.ActionLocator,
        pageobject.newcolumn
      );
    });
    await page.waitForTimeout(1000);
    await page.click(pageobject.nextoption);
    await functions.views();
  });

  // "Embed a view" is disabled with fewer than 2 compatible views
  test("create a second view on People (needed for embedding to be enabled)", async () => {
    await functions.views();
    await page.click(pageobject.createnewview);
    await page.fill(pageobject.InputName, "People_show_dummy");
    await customAssert("View pattern should be Show", async () => {
      const pattern = await page.$("#inputviewtemplate");
      await pattern?.selectOption("Show");
    });
    await functions.submit();
    await page.waitForTimeout(1000);
    await page.click(pageobject.nextoption);
    await functions.views();
  });

  test("create outer Edit view embedding People_list_inner", async () => {
    await functions.views();
    await page.click(pageobject.createnewview);
    await page.fill(pageobject.InputName, "People_edit_outer");
    await page.fill(
      pageobject.discriptiontext,
      "edit view embedding People_list_inner"
    );
    await customAssert("View pattern should be Edit", async () => {
      const pattern = await page.$("#inputviewtemplate");
      await pattern?.selectOption("Edit");
    });
    await functions.submit();
    await page.waitForTimeout(1000);

    await customAssert(
      'Drag "Embed a view" element into the layout',
      async () => {
        await functions.drag_And_Drop(
          pageobject.embedViewSource,
          pageobject.secondrowcolumn
        );
      }
    );
    await page.waitForTimeout(1000);
    await customAssert(
      "Select People_list_inner as the embedded view",
      async () => {
        // option label is "<name> [<viewtemplate>] <table>", not the bare name
        await page
          .locator(`${pageobject.viewSelector} .builder-select__control`)
          .click();
        await page.getByText(/^People_list_inner \[List\]/).click();
      }
    );
    await customAssert(
      'Set relation to "no relation" (show all rows, not just the one being edited)',
      async () => {
        await page.click(pageobject.selectButton);
        await page.click('li:has-text("none (no relation)")');
      }
    );
    await page.waitForTimeout(1000);
    await page.click(pageobject.nextoption);
    await functions.views();
  });

  test("embedded Delete action works without a nested <form>", async () => {
    await page.goto(`${baseURL}/view/People_edit_outer?id=2`);
    await page.waitForTimeout(1000);

    const outerForm = page.locator('form[data-viewname="People_edit_outer"]');
    await expect(outerForm).toBeVisible();

    // admins get a second config-popover wrapper - take the first match
    const embed = outerForm
      .locator('[data-sc-embed-viewname="People_list_inner"]')
      .first();
    await expect(embed).toBeVisible();

    // the regression check: no <form> nested inside outerForm
    await expect(embed.locator("form")).toHaveCount(0);

    // delete a row other than id=2, the one being edited
    const row = embed.locator("tr", { hasText: "Brandon" });
    await expect(row).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await row.getByText("Delete").click();
    await page.waitForTimeout(1500);

    await expect(embed.locator("tr", { hasText: "Brandon" })).toHaveCount(0);
    // outer form's own row (id=2) is unaffected by the embedded delete
    await expect(page.locator("#inputfull_name")).toHaveValue("Adam");
  });
});
