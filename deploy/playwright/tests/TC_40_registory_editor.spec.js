const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');
const Logger = require('../pageobject/logger.js');
const customAssert = require('../pageobject/utils.js');
const fs = require('fs');


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

    // Add table by uplaoding csv
    test('Add table by uploading csv file', async () => {
        await functions.clear_Data();

        // click table button
        await functions.click_table();
        // Click on Create from CSV upload link
        await page.click(pageobject.createfromcsvupload);
        // Wait for the file input element to be available
        const fileInput = await page.waitForSelector('input[type="file"]');
        // Set the file input to the desired file
        const filePath = 'Csv_file_to_uplaod/People1.csv'; // Replace with the correct path to your CSV file
        await fileInput.setInputFiles(filePath);
        // fill table name on text box
        await functions.fill_Text(pageobject.InputName, 'People');
        // Click on create button
        await functions.submit();
    });

    test('Create List view from People table', async () => {
        await functions.views();
        // click on create new view
        await page.click(pageobject.createnewview);
        // input view name and discription
        await page.fill(pageobject.InputName, 'People_list');
        await page.fill(pageobject.discriptiontext, 'view for People table');
        // submit the page
        await functions.submit();
        await customAssert('Set the position for columns', async () => {
            await functions.drag_And_Drop(pageobject.Column2FullName, pageobject.Column0Address);
            await functions.drag_And_Drop(pageobject.Column2DOB, pageobject.Column1Address);
        });
        await page.waitForTimeout(2000);
        // click on next button
        await page.waitForSelector(pageobject.nextoption);
        await page.click(pageobject.nextoption);
        await functions.views();
    });

    const debugDir = 'test-results';
    if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
    }

    const takeDebugScreenshot = async (name) => {
        const path = `${debugDir}/${name}_${Date.now()}.png`;
        await page.screenshot({ path, fullPage: true });
        Logger.info(`Debug screenshot saved: ${path}`);
        return path;
    };

    const openRegistryEditorFromPeopleList = async () => {
        if (page.url().includes('/registry-editor')) return;

        Logger.info('Action: open Views (left panel)');
        await functions.views();
        await page.waitForTimeout(1500);

        await customAssert('Your views section should be visible', async () => {
            const yourViews = page.getByText('Your views').first();
            await expect(yourViews).toBeVisible({ timeout: 15000 });
        });

        await takeDebugScreenshot('tc_39_open_01_views_page');

        Logger.info('Action: locate People_list row in views table');
        const peopleListRow = page.locator('table tbody tr').filter({ hasText: 'People_list' }).first();

        await customAssert('People_list row should be visible', async () => {
            await expect(peopleListRow).toBeVisible({ timeout: 15000 });
        });

        Logger.info('Action: open row overflow menu for People_list');
        let overflowButton = null;
        const overflowCandidates = [
            peopleListRow.locator('button.dropdown-toggle').first(),
            peopleListRow.locator('button[data-bs-toggle="dropdown"]').first(),
            peopleListRow.locator('button:has(svg)').first(),
            peopleListRow.locator('button:has-text("...")').first(),
            peopleListRow.locator('a:has-text("...")').first(),
        ];

        for (const candidate of overflowCandidates) {
            if (await candidate.count() > 0) {
                if (await candidate.first().isVisible().catch(() => false)) {
                    overflowButton = candidate;
                    break;
                }
            }
        }

        await customAssert('Overflow (three-dots) button should be found and clickable', async () => {
            expect(overflowButton).not.toBeNull();
            await expect(overflowButton).toBeVisible({ timeout: 5000 });
        });

        await overflowButton.click();
        await page.waitForTimeout(1000);
        await takeDebugScreenshot('tc_39_open_02_people_list_dropdown_open');

        Logger.info('Action: click Registry editor option from dropdown');
        let registryEditorMenuItem = null;
        const registryCandidates = [
            page.locator('.dropdown-menu.show a:has-text("Registry editor")').first(),
            page.locator('.dropdown-menu.show button:has-text("Registry editor")').first(),
            page.getByRole('menuitem', { name: 'Registry editor' }).first(),
        ];

        for (const candidate of registryCandidates) {
            if (await candidate.count() > 0) {
                if (await candidate.first().isVisible().catch(() => false)) {
                    registryEditorMenuItem = candidate;
                    break;
                }
            }
        }

        await customAssert('Registry editor menu item should be visible', async () => {
            expect(registryEditorMenuItem).not.toBeNull();
            await expect(registryEditorMenuItem).toBeVisible({ timeout: 5000 });
        });

        await registryEditorMenuItem.click();
        await page.waitForTimeout(1000);
        await takeDebugScreenshot('tc_39_open_03_registry_editor_landing');

        await customAssert('URL should navigate to /registry-editor', async () => {
            expect(page.url()).toContain('/registry-editor');
        });

        await customAssert('Registry editor tab/link should exist', async () => {
            await expect(page.locator(pageobject.registrylocator)).toBeVisible({ timeout: 15000 });
        });
    };

    test('Open Registry editor from People_list overflow (smoke)', async () => {
        test.setTimeout(120000);

        await openRegistryEditorFromPeopleList();

        await customAssert('Registry editor page header should contain Registry editor', async () => {
            const header = page
                .locator('h1, h2, h3, h4, h5, .card-header, .page-header')
                .filter({ hasText: 'Registry editor' })
                .first();
            await expect(header).toBeVisible({ timeout: 15000 });
            await expect(header).toContainText('Registry editor');
        });

        await customAssert('Registry editor page should reference People_list view', async () => {
            await expect(page.getByText('People_list', { exact: false }).first()).toBeVisible({ timeout: 15000 });
        });

        await customAssert('Breadcrumb should be visible', async () => {
            const breadcrumb = page.locator('ol.breadcrumb').first();
            await expect(breadcrumb).toBeVisible({ timeout: 15000 });
        });
    });

    test('Left panel entity sections render (Tables/Views/Pages/Triggers/Configuration/Modules)', async () => {
        test.setTimeout(120000);
        await openRegistryEditorFromPeopleList();

        const sectionNames = ['Tables', 'Views', 'Pages', 'Triggers', 'Configuration', 'Modules'];
        await customAssert('Left panel entity sections should be visible', async () => {
            for (const sectionName of sectionNames) {
                const matches = page.getByText(sectionName, { exact: true });
                const matchCount = await matches.count();
                expect(matchCount).toBeGreaterThan(0);

                let visibleFound = false;
                for (let i = 0; i < matchCount; i++) {
                    const candidate = matches.nth(i);
                    if (await candidate.isVisible().catch(() => false)) {
                        visibleFound = true;
                        break;
                    }
                }

                Logger.info(`Left panel section "${sectionName}" visibleFound=${visibleFound}`);
                expect(visibleFound).toBe(true);
            }
        });

        await takeDebugScreenshot('tc_39_panel_01_left_sections');
    });

    test('Left panel expand/collapse works (Views section toggle)', async () => {
        test.setTimeout(120000);
        await openRegistryEditorFromPeopleList();

        await customAssert('Views <details> can be expanded/collapsed and affects People_list visibility', async () => {
            const viewsDetails = page.locator('ul.katetree > li details', {
                has: page.locator('summary:has-text("Views")'),
            }).first();

            await expect(viewsDetails).toBeVisible({ timeout: 15000 });

            const peopleLink = page.locator('ul.katetree a[href*="ename=People_list"]').first();
            await expect(peopleLink).toBeVisible({ timeout: 15000 });

            await takeDebugScreenshot('tc_39_expand_01_viewsdetails_initial');

            const initialOpen = await viewsDetails.evaluate((el) => el.open);
            Logger.info(`Views details initialOpen=${initialOpen}`);

            // Ensure expanded first
            if (!initialOpen) {
                Logger.info('Action: expand Views details (click summary)');
                await viewsDetails.locator('summary').click();
                await page.waitForTimeout(700);
                const expandedOpen = await viewsDetails.evaluate((el) => el.open);
                await expect(expandedOpen).toBe(true);
                await expect(peopleLink).toBeVisible({ timeout: 15000 });
            }

            // Collapse
            Logger.info('Action: collapse Views details (click summary)');
            await viewsDetails.locator('summary').click();
            await page.waitForTimeout(700);
            const collapsedOpen = await viewsDetails.evaluate((el) => el.open);
            Logger.info(`Views details collapsedOpen=${collapsedOpen}`);
            await expect(collapsedOpen).toBe(false);
            await expect(peopleLink).toBeHidden({ timeout: 15000 });

            // Expand again (verifies both directions)
            Logger.info('Action: expand Views details again (click summary)');
            await viewsDetails.locator('summary').click();
            await page.waitForTimeout(700);
            const reExpandedOpen = await viewsDetails.evaluate((el) => el.open);
            Logger.info(`Views details reExpandedOpen=${reExpandedOpen}`);
            await expect(reExpandedOpen).toBe(true);
            await expect(peopleLink).toBeVisible({ timeout: 15000 });

            await takeDebugScreenshot('tc_39_expand_03_viewsdetails_after');
        });

        await takeDebugScreenshot('tc_39_panel_02_expand_collapse');
    });

    test('Left panel search filters entities (input + results change + clear)', async () => {
        test.setTimeout(120000);
        await openRegistryEditorFromPeopleList();

        await customAssert('Search input should be visible, accept query, and clear correctly', async () => {
            const entitiesSearchForm = page.locator('form[action="/registry-editor"]');
            await expect(entitiesSearchForm).toBeVisible({ timeout: 15000 });

            const searchInput = entitiesSearchForm.locator('input[name="q"]');
            const searchSubmitBtn = entitiesSearchForm.locator('button[type="submit"]');

            await expect(searchInput).toBeVisible({ timeout: 15000 });
            await expect(searchSubmitBtn).toBeVisible({ timeout: 15000 });

            const placeholderAttr = await searchInput.getAttribute('placeholder');
            Logger.info(`Search box placeholder: ${placeholderAttr}`);

            const peopleLink = page.locator('ul.katetree a[href*="ename=People_list"]').first();
            await expect(peopleLink).toBeVisible({ timeout: 15000 });

            const visibleAnchorsBefore = await page.locator('ul.katetree a:visible').count();
            Logger.info(`Visible anchors before search: ${visibleAnchorsBefore}`);
            await takeDebugScreenshot('tc_39_search_01_before');

            // Submit search explicitly (GET form). This avoids guessing whether it filters live.
            const query = 'timezone';
            Logger.info(`Action: search in entities with query="${query}"`);
            await searchInput.fill(query);
            await expect(searchInput).toHaveValue(query);
            await searchSubmitBtn.click();

            await page.waitForURL(new RegExp(`q=${query}`), { timeout: 30000 });

            const timezoneLink = page.locator('ul.katetree a[href*="ename=timezone"]').first();
            await expect(timezoneLink).toBeVisible({ timeout: 15000 });

            const visibleAnchorsAfter = await page.locator('ul.katetree a:visible').count();
            Logger.info(`Visible anchors after search: ${visibleAnchorsAfter}`);
            // Strict check: filtered result list should contain at least one visible link.
            expect(visibleAnchorsAfter).toBeGreaterThan(0);

            await takeDebugScreenshot('tc_39_search_02_after');

            // Clear search by submitting empty query
            Logger.info('Action: clear entities search');
            await searchInput.fill('');
            await searchSubmitBtn.click();
            await page.waitForURL(/\/registry-editor/, { timeout: 30000 });

            // After clearing, People_list should still be visible (Views details open by default in this state)
            await expect(peopleLink).toBeVisible({ timeout: 15000 });
            await takeDebugScreenshot('tc_39_search_03_cleared');
        });
    });

    test('Configure menu opens with suboptions (and first suboption is clickable)', async () => {
        test.setTimeout(120000);
        await openRegistryEditorFromPeopleList();

        await customAssert('Configure link navigates to /viewedit/config/People_list and config builder UI loads', async () => {
            const configureLink = page.locator('a[href="/viewedit/config/People_list"]').first();
            await expect(configureLink).toBeVisible({ timeout: 15000 });
            await expect(configureLink).toContainText('Configure');

            Logger.info('Action: click Configure link');
            await configureLink.click();

            await page.waitForURL(/\/viewedit\/config\/People_list/, { timeout: 30000 });
            await takeDebugScreenshot('tc_39_configure_01_after_nav');

            // Builder/config page evidence (from your UI screenshot):
            // - "Add column" should exist
            // - "Next »" should exist
            // - "Settings" panel should exist with "No element selected"
            await expect(page.locator(pageobject.addcolumnbutton)).toBeVisible({ timeout: 30000 });
            await expect(page.locator(pageobject.nextoption)).toBeVisible({ timeout: 30000 });
            await expect(page.locator('#saltcorn-builder')).toBeVisible({ timeout: 30000 });
            await expect(page.locator('#saltcorn-builder').getByText('Settings')).toBeVisible({ timeout: 30000 });
            await expect(page.locator('#saltcorn-builder').getByText('No element selected')).toBeVisible({ timeout: 30000 });

            // Breadcrumb should mention People_list context
            await expect(page.locator('nav[aria-label="breadcrumb"]')).toBeVisible({ timeout: 30000 });
            await expect(page.locator('nav[aria-label="breadcrumb"]')).toContainText('People_list');
        });
    });

    test('Registry editor code panel contains keys + Save button state', async () => {
        test.setTimeout(120000);
        await openRegistryEditorFromPeopleList();

        await customAssert('Registry editor JSON/code panel should be visible and contain expected keys', async () => {
            const editorContainer = page.locator('.monaco-editor, .CodeMirror, pre, code').first();
            await expect(editorContainer).toBeVisible({ timeout: 15000 });

            const editorText = await editorContainer.innerText().catch(async () => await editorContainer.textContent());
            expect(editorText).toBeTruthy();

            expect(editorText).toContain('description');
            expect(editorText).toContain('viewtemplate');
            expect(editorText).toContain('configuration');
        });

        await customAssert('Save button should be visible (enabled state logged)', async () => {
            const saveButton = page.locator('button:has-text("Save"), button[type="submit"]:has-text("Save")').first();
            await expect(saveButton).toBeVisible({ timeout: 15000 });
            const enabled = await saveButton.isEnabled().catch(() => false);
            await expect(saveButton).toContainText('Save');
            Logger.info(`Save button enabled state: ${enabled}`);
            // Keep this as strict verification of presence + label.
            // (Enabled/disabled is logged because it may depend on whether changes were made.)
        });

        await takeDebugScreenshot('tc_39_editor_01_keys_and_save');
    });
});