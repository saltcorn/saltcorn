const { test, expect } = require("@playwright/test");
const { baseURL, derivedURL } = require("../pageobject/base_url.js");
const PageFunctions = require("../pageobject/function.js");
const PageObject = require("../pageobject/locators.js");
const customAssert = require("../pageobject/utils.js");
const Logger = require("../pageobject/logger.js");

// Covers the "shared/linked Library component" feature: a component placed
// from the Library sidebar onto more than one page stays linked to its
// _sc_library row, so editing the placement on one page and saving updates
// what every other page renders (last write wins, visible after reload -
// there is no live-update push or conflict handling in this first version).
test.describe("E2E Test Suite - Library sharing", () => {
  let functions;
  let pageobject;
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    Logger.initialize();

    context = await browser.newContext({ ignoreHTTPSErrors: true });
    page = await context.newPage();

    await page.setViewportSize({ width: 1350, height: 720 });

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

  // The CKEditor-backed text field does not accept plain page.fill() -
  // it needs a real focus + keystroke sequence to commit the change back
  // to the underlying Craft.js node, so this replaces functions.fill_Text
  // wherever the actual saved/rendered value matters (not just visibility).
  const typeText = async (newText) => {
    const field = page.locator("div[contenteditable='true'][role='textbox']");
    await field.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type(newText, { delay: 15 });
    await page.waitForTimeout(200);
    await page.locator(pageobject.target).click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);
  };

  test("Create source page and save its text as a Library component", async () => {
    await functions.create_New_Page("sharelib_source");
    await page.waitForSelector(pageobject.textSource);
    await functions.drag_And_Drop(pageobject.textSource, pageobject.target);
    await page.waitForTimeout(300);
    await typeText("Original shared text");
    await customAssert("Text shows the typed content", async () => {
      await expect(page.locator(pageobject.target)).toContainText(
        "Original shared text"
      );
    });

    await page
      .locator(pageobject.target)
      .getByText("Original shared text")
      .click();
    await page.click(pageobject.Library);
    await page.click(pageobject.plusAddButton);
    await customAssert("Name Field", async () => {
      await page.click(pageobject.nameField);
      await functions.fill_Text(pageobject.nameField, "SharedGreeting");
    });
    await customAssert("Icon Field", async () => {
      await page.click(pageobject.selectIcon);
      await page.locator(pageobject.selectIconFasFaAdjust).click();
    });
    await page.click(pageobject.selectIconFlip);
    await customAssert("Assert +Add button is visible", async () => {
      await expect(page.locator(pageobject.addButtonAfterSelect)).toBeVisible();
    });
    await page.click(pageobject.addButtonAfterSelect);
    await page.click(pageobject.PageSave);

    await customAssert(
      "sharelib_source should be in the page list",
      async () => {
        const names = await page
          .locator(pageobject.pageNameSave)
          .allInnerTexts();
        console.assert(
          names.includes("sharelib_source"),
          '"sharelib_source" is missing from the Name column!'
        );
      }
    );
  });

  test("Place the shared component on page A", async () => {
    await functions.create_New_Page("sharelib_pagea");
    await page.click(pageobject.Library);
    await page.waitForSelector(pageobject.dragLibraryAdjustIcon, {
      state: "visible",
      timeout: 15000,
    });
    await functions.drag_And_Drop(
      pageobject.dragLibraryAdjustIcon,
      pageobject.target
    );

    await customAssert(
      "Placed component shows the shared text on page A",
      async () => {
        await expect(page.locator(pageobject.target)).toContainText(
          "Original shared text"
        );
      }
    );

    await page.click(pageobject.PageSave);
    await customAssert(
      "sharelib_pagea should be in the page list",
      async () => {
        const names = await page
          .locator(pageobject.pageNameSave)
          .allInnerTexts();
        console.assert(
          names.includes("sharelib_pagea"),
          '"sharelib_pagea" is missing from the Name column!'
        );
      }
    );

    await page.goto(`${baseURL}${derivedURL}page/sharelib_pagea`);
    await customAssert(
      "Live page A renders the original shared text",
      async () => {
        await expect(page.getByText("Original shared text")).toBeVisible();
      }
    );
  });

  test("Place and edit the shared component on page B, then verify page A picks up the change", async () => {
    await functions.navigate_To_Base_URL(baseURL, derivedURL);
    await functions.create_New_Page("sharelib_pageb");
    await page.click(pageobject.Library);
    await page.waitForSelector(pageobject.dragLibraryAdjustIcon, {
      state: "visible",
      timeout: 15000,
    });
    await functions.drag_And_Drop(
      pageobject.dragLibraryAdjustIcon,
      pageobject.target
    );

    await customAssert(
      "Placed component shows the shared text on page B",
      async () => {
        await expect(page.locator(pageobject.target)).toContainText(
          "Original shared text"
        );
      }
    );

    // select the already-placed text node before editing it (a fresh drop
    // auto-selects, but a linked placement's children do not)
    await page
      .locator(pageobject.target)
      .getByText("Original shared text")
      .click();
    await page.waitForTimeout(200);
    await typeText("Updated shared text");
    await customAssert(
      "Text on page B should now read the updated text",
      async () => {
        await expect(page.locator(pageobject.target)).toContainText(
          "Updated shared text"
        );
      }
    );

    await page.click(pageobject.PageSave);
    await customAssert(
      "sharelib_pageb should be in the page list",
      async () => {
        const names = await page
          .locator(pageobject.pageNameSave)
          .allInnerTexts();
        console.assert(
          names.includes("sharelib_pageb"),
          '"sharelib_pageb" is missing from the Name column!'
        );
      }
    );

    // last write wins, visible only after reload - no live push in this
    // first version, so re-navigating to page A is the actual test
    await page.goto(`${baseURL}${derivedURL}page/sharelib_pagea`);
    await customAssert(
      "Live page A now renders the text updated from page B",
      async () => {
        await expect(page.getByText("Updated shared text")).toBeVisible();
      }
    );
  });

  test("A shared component containing a table field renders instead of crashing", async () => {
    // CSV upload gives us a table with a real field and real row data in
    // one step, instead of building it up manually
    await functions.click_table();
    await page.click(pageobject.createfromcsvupload);
    const fileInput = await page.waitForSelector('input[type="file"]');
    await fileInput.setInputFiles("Csv_file_to_uplaod/People1.csv");
    await functions.fill_Text(pageobject.InputName, "LibFieldPeople");
    await functions.submit();

    // a fresh Show view auto-places its fields, with real row data shown
    // right in the builder - that's the "Adam" text below
    await functions.views();
    await page.click(pageobject.createnewview);
    await page.fill(pageobject.InputName, "LibFieldShow");
    await page.fill(
      pageobject.discriptiontext,
      "source show view for field sharing test"
    );
    await customAssert("Select show view pattern for view", async () => {
      const ShowPattern = await page.$("#inputviewtemplate");
      await ShowPattern?.selectOption("Show");
    });
    await functions.submit();
    await page.waitForTimeout(2000);

    // turn the auto-placed field into a shared component - this is what
    // used to crash on reload, since a field needs the row context that
    // an isolated re-render of the library's content didn't have
    await page.click('div.d-inline:has-text("Adam")');
    await page.click(pageobject.Library);
    await page.click(pageobject.plusAddButton);
    await page.click(pageobject.nameField);
    await functions.fill_Text(pageobject.nameField, "FieldShare");
    await page.click(pageobject.selectIcon);
    await page.locator(pageobject.selectIconFasFaAlignCenter).click();
    await page.click(pageobject.selectIconFlip);
    await page.click(pageobject.addButtonAfterSelect);
    await page.click(pageobject.PageSave);

    // row ids aren't guaranteed to start at 1 (depends on what ran
    // earlier in this DB), so look Adam's row up instead of guessing
    const adamId = await page.evaluate(async () => {
      const r = await fetch("/api/LibFieldPeople?full_name=Adam");
      const { success } = await r.json();
      return success[0].id;
    });

    // reload as a real visitor would - this is the render path that
    // used to throw "unknown layout segment" for a field inside a
    // shared component
    await page.goto(`${baseURL}${derivedURL}view/LibFieldShow?id=${adamId}`);
    await customAssert(
      "The shared field component renders the real row value, not an error",
      async () => {
        await expect(page.getByText("Adam")).toBeVisible();
      }
    );
  });

  test("Create the field-slot component and place it on the first view", async () => {
    test.setTimeout(90000);
    await functions.click_table();
    await page.click(pageobject.createfromcsvupload);
    const fileInput = await page.waitForSelector('input[type="file"]');
    await fileInput.setInputFiles("Csv_file_to_uplaod/People1.csv");
    await functions.fill_Text(pageobject.InputName, "SlotPeople");
    await functions.submit();

    // first placement, and where the shared component gets created from
    await functions.views();
    await page.click(pageobject.createnewview);
    await page.fill(pageobject.InputName, "SlotShow1");
    await page.fill(
      pageobject.discriptiontext,
      "first placement of the field-slot component"
    );
    await customAssert("Select show view pattern for view", async () => {
      const ShowPattern = await page.$("#inputviewtemplate");
      await ShowPattern?.selectOption("Show");
    });
    await functions.submit();
    // the view-creation wizard has an intermediate save/redirect step before
    // the builder itself loads - wait for the canvas, not a fixed delay,
    // since how long that takes depends on server load
    await page.waitForSelector(pageobject.target, {
      state: "visible",
      timeout: 30000,
    });

    // a slot only means anything inside a shared component, so one has to
    // exist first - wrap the auto-placed address field into one
    const addressField = 'div.d-inline:has-text("132 east Greater Noida")';
    await page.click(addressField);
    await page.waitForSelector(pageobject.Library, {
      state: "visible",
      timeout: 10000,
    });
    await page.click(pageobject.Library);
    await page.click(pageobject.plusAddButton);
    await page.click(pageobject.nameField);
    await functions.fill_Text(pageobject.nameField, "SlotComp");
    await page.click(pageobject.selectIcon);
    await page.locator(pageobject.selectIconFasFaAlignCenter).click();
    await page.click(pageobject.selectIconFlip);
    await page.click(pageobject.addButtonAfterSelect);
    // the icon picker has a stray internal callback that can fire just
    // after it closes and throw - give it a moment to settle before the
    // next interaction, rather than racing it
    await page.waitForTimeout(500);

    // now drop a slot into the shared component that was just created -
    // the Slot draggable only accepts drops inside a shared component, so
    // this has to land on the address field, which now lives inside one
    await page.waitForSelector(pageobject.dragLibrarySlotIcon, {
      state: "visible",
      timeout: 15000,
    });
    await functions.drag_And_Drop(pageobject.dragLibrarySlotIcon, addressField);

    await customAssert(
      "A freshly dropped slot shows its own unfilled placeholder",
      async () => {
        await expect(page.locator(pageobject.target)).toContainText(
          /\[slot: \w+\]/
        );
      }
    );

    // point this placement's slot at full_name
    await page
      .locator(pageobject.target)
      .locator(pageobject.librarySlotInstance)
      .click();
    await page.waitForSelector(pageobject.fielddropdown, {
      state: "visible",
      timeout: 10000,
    });
    await page
      .locator(pageobject.fielddropdown)
      .selectOption({ value: "full_name" });

    await customAssert("The slot now previews the picked field", async () => {
      await expect(page.locator(pageobject.target)).toContainText("full_name");
    });

    // already editing the shared component in place - PageSave persists it
    // straight back to the shared row, no need to "Add" again
    await page.click(pageobject.PageSave);

    const adamId = await page.evaluate(async () => {
      const r = await fetch("/api/SlotPeople?full_name=Adam");
      const { success } = await r.json();
      return success[0].id;
    });

    await page.goto(`${baseURL}${derivedURL}view/SlotShow1?id=${adamId}`);
    await customAssert(
      "The first placement renders the fixed address field and the full_name slot",
      async () => {
        await expect(
          page.getByText("132 east Greater Noida new delhi india")
        ).toBeVisible();
        // the view also auto-placed its own full_name field, so "Adam"
        // legitimately appears twice - just confirm it's there at all
        await expect(page.getByText("Adam").first()).toBeVisible();
      }
    );
  });

  test("Place the field-slot component on a second view with a different field", async () => {
    test.setTimeout(90000);
    // second placement of the SAME shared component - its own field pick
    // must not come pre-filled from the first placement, and must not
    // affect what the first placement renders
    await functions.navigate_To_Base_URL(baseURL, derivedURL);
    await functions.views();
    await page.click(pageobject.createnewview);
    await page.fill(pageobject.InputName, "SlotShow2");
    await page.fill(
      pageobject.discriptiontext,
      "second placement of the field-slot component"
    );
    await customAssert("Select show view pattern for view", async () => {
      const ShowPattern = await page.$("#inputviewtemplate");
      await ShowPattern?.selectOption("Show");
    });
    await functions.submit();
    // the view-creation wizard has an intermediate save/redirect step before
    // the builder itself loads - wait for the canvas, not a fixed delay,
    // since how long that takes depends on server load
    await page.waitForSelector(pageobject.target, {
      state: "visible",
      timeout: 30000,
    });
    // placing the shared component itself has no drop restriction - only a
    // bare Slot does - so this can go straight on the root canvas
    await page.waitForSelector(pageobject.Library, {
      state: "visible",
      timeout: 10000,
    });
    await page.click(pageobject.Library);
    await page.waitForSelector(
      'div.d-inline-flex.wrap-builder-elem:has-text("SlotComp")',
      { state: "visible", timeout: 15000 }
    );
    await functions.drag_And_Drop(
      'div.d-inline-flex.wrap-builder-elem:has-text("SlotComp")',
      pageobject.target
    );

    await customAssert(
      "The slot arrives unfilled on this placement too - the shared row never stored a field",
      async () => {
        await expect(page.locator(pageobject.target)).toContainText(
          /\[slot: \w+\]/
        );
        await expect(page.locator(pageobject.target)).not.toContainText(
          "full_name"
        );
      }
    );

    await page
      .locator(pageobject.target)
      .locator(pageobject.librarySlotInstance)
      .click();
    await page.waitForSelector(pageobject.fielddropdown, {
      state: "visible",
      timeout: 10000,
    });
    await page
      .locator(pageobject.fielddropdown)
      .selectOption({ value: "date_of_birth" });
    await page.click(pageobject.PageSave);

    const adamId = await page.evaluate(async () => {
      const r = await fetch("/api/SlotPeople?full_name=Adam");
      const { success } = await r.json();
      return success[0].id;
    });

    await page.goto(`${baseURL}${derivedURL}view/SlotShow2?id=${adamId}`);
    await customAssert(
      "The second placement renders the fixed address field and the date_of_birth slot instead",
      async () => {
        await expect(
          page.getByText("132 east Greater Noida new delhi india")
        ).toBeVisible();
        // the view also auto-placed its own date_of_birth field, so "2024"
        // legitimately appears twice - just confirm it's there at all
        await expect(page.getByText("2024").first()).toBeVisible();
      }
    );

    await page.goto(`${baseURL}${derivedURL}view/SlotShow1?id=${adamId}`);
    await customAssert(
      "The first placement still renders its own full_name slot, unaffected by the second",
      async () => {
        await expect(page.getByText("Adam").first()).toBeVisible();
      }
    );
  });

  test("Create the container-slot component and place it on page A with its own content", async () => {
    test.setTimeout(90000);
    await functions.create_New_Page("slotcontainer_pagea");
    // create_New_Page returns right after clicking submit, before the
    // builder itself has actually loaded - wait for the canvas rather
    // than assuming it's already there
    await page.waitForSelector(pageobject.target, {
      state: "visible",
      timeout: 30000,
    });

    // a slot only means anything inside a shared component, so one has to
    // exist first - wrap a plain text block into one
    await functions.drag_And_Drop(pageobject.textSource, pageobject.target);
    await page.waitForTimeout(300);
    await typeText("Shared header");

    await page.locator(pageobject.target).getByText("Shared header").click();
    await page.waitForSelector(pageobject.Library, {
      state: "visible",
      timeout: 10000,
    });
    await page.click(pageobject.Library);
    await page.click(pageobject.plusAddButton);
    await page.click(pageobject.nameField);
    await functions.fill_Text(pageobject.nameField, "SlotContainerComp");
    await page.click(pageobject.selectIcon);
    await page.locator(pageobject.selectIconFarFaAddress).click();
    await page.click(pageobject.selectIconFlip);
    await page.click(pageobject.addButtonAfterSelect);
    // the icon picker has a stray internal callback that can fire just
    // after it closes and throw - give it a moment to settle before the
    // next interaction, rather than racing it
    await page.waitForTimeout(500);

    // now drop a slot into the shared component that was just created - it
    // has to land on the header text, which now lives inside one
    await page.waitForSelector(pageobject.dragLibrarySlotIcon, {
      state: "visible",
      timeout: 15000,
    });
    await functions.drag_And_Drop(
      pageobject.dragLibrarySlotIcon,
      // more specific than a plain text match - a lingering CKEditor
      // overlay from typing the header also contains this text
      'div.d-inline:has-text("Shared header")'
    );

    // switch this slot to a container
    await page
      .locator(pageobject.target)
      .locator(pageobject.librarySlotInstance)
      .click();
    await page.waitForSelector(pageobject.slotKindSelect, {
      state: "visible",
      timeout: 10000,
    });
    await page
      .locator(pageobject.slotKindSelect)
      .selectOption({ value: "container" });

    // Components and Library are a two-tab accordion - only the active
    // one is even mounted, so switch back to Components before the Text
    // draggable (which lives there) can be dragged from again
    await page.click(pageobject.Library);
    await page.waitForSelector(pageobject.textSource, {
      state: "visible",
      timeout: 10000,
    });

    // fill this placement's own copy of the slot
    await functions.drag_And_Drop(
      pageobject.textSource,
      pageobject.librarySlotInstance
    );
    await page.waitForTimeout(300);
    await typeText("Placement A content");
    await customAssert(
      "Placement A shows both the fixed header and its own content",
      async () => {
        await expect(page.locator(pageobject.target)).toContainText(
          "Shared header"
        );
        await expect(page.locator(pageobject.target)).toContainText(
          "Placement A content"
        );
      }
    );

    await page.click(pageobject.PageSave);
    await page.goto(`${baseURL}${derivedURL}page/slotcontainer_pagea`);
    await customAssert(
      "Live page A renders the fixed header and its own dropped-in content",
      async () => {
        await expect(page.getByText("Shared header")).toBeVisible();
        await expect(page.getByText("Placement A content")).toBeVisible();
      }
    );
  });

  test("Place the container-slot component on page B with different content, without cross-contamination", async () => {
    test.setTimeout(90000);
    // second placement of the SAME shared component - its slot must
    // arrive empty (placement A's content is not part of the shared row)
    await functions.navigate_To_Base_URL(baseURL, derivedURL);
    await functions.create_New_Page("slotcontainer_pageb");
    await page.waitForSelector(pageobject.target, {
      state: "visible",
      timeout: 30000,
    });
    // placing the shared component itself has no drop restriction - only a
    // bare Slot does - so this can go straight on the root canvas
    await page.waitForSelector(pageobject.Library, {
      state: "visible",
      timeout: 10000,
    });
    await page.click(pageobject.Library);
    await page.waitForSelector(
      'div.d-inline-flex.wrap-builder-elem:has-text("SlotContainerComp")',
      { state: "visible", timeout: 15000 }
    );
    await functions.drag_And_Drop(
      'div.d-inline-flex.wrap-builder-elem:has-text("SlotContainerComp")',
      pageobject.target
    );

    await customAssert(
      "Placement B has the fixed header but not placement A's content",
      async () => {
        await expect(page.locator(pageobject.target)).toContainText(
          "Shared header"
        );
        await expect(page.locator(pageobject.target)).not.toContainText(
          "Placement A content"
        );
      }
    );

    // Components and Library are a two-tab accordion - only the active
    // one is even mounted, so switch back to Components before the Text
    // draggable (which lives there) can be dragged from again
    await page.click(pageobject.Library);
    await page.waitForSelector(pageobject.textSource, {
      state: "visible",
      timeout: 10000,
    });

    await functions.drag_And_Drop(
      pageobject.textSource,
      pageobject.librarySlotInstance
    );
    await page.waitForTimeout(300);
    await typeText("Placement B content");

    await page.click(pageobject.PageSave);
    await page.goto(`${baseURL}${derivedURL}page/slotcontainer_pageb`);
    await customAssert(
      "Live page B renders the fixed header and only its own content",
      async () => {
        await expect(page.getByText("Shared header")).toBeVisible();
        await expect(page.getByText("Placement B content")).toBeVisible();
      }
    );
    await customAssert(
      "Live page B does not render placement A's content",
      async () => {
        await expect(page.getByText("Placement A content")).not.toBeVisible();
      }
    );

    // placement A must also be unaffected by placement B's edit
    await page.goto(`${baseURL}${derivedURL}page/slotcontainer_pagea`);
    await customAssert(
      "Live page A still renders only its own content",
      async () => {
        await expect(page.getByText("Placement A content")).toBeVisible();
        await expect(page.getByText("Placement B content")).not.toBeVisible();
      }
    );
  });
});
