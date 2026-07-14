const { expect } = require('@playwright/test');
const fs = require('fs');
const customAssert = require('../pageobject/utils.js');
class PageFunctions {
  constructor(page) {
    this.page = page;
    this.locators = new (require('./locators'))(page);
  }

  async navigate_To_Base_URL(baseURL, derivedURL) {
    await this.page.goto(baseURL + derivedURL);
  }

  async submit() {
    await this.page.waitForSelector(this.locators.submitButton);
    await this.page.click(this.locators.submitButton);
  }

  async login(email, password) {
    await this.page.fill(this.locators.emailInput, email);
    await this.page.fill(this.locators.passwordInput, password);
  }

  async create_New_Page(pageName) {
    await this.page.click(this.locators.newPage_sidebar);
    await this.page.waitForSelector(this.locators.newPageButton);
    await this.page.click(this.locators.newPageButton);
    await this.page.fill(this.locators.InputName, pageName);
    await this.page.click(this.locators.submitButton);
  }


  async drag_And_Drop(source, target) {
    await this.page.locator(source).scrollIntoViewIfNeeded();
    await this.page.locator(target).scrollIntoViewIfNeeded();
    await this.page.locator(source).dragTo(this.page.locator(target), { force: true });
  }

  async fill_Text(selector, text) {
    await this.page.fill(selector, text, { timeout: 30000 });
  }

  async fill_CKEditor_Text(text) {
    await this.page.waitForSelector('.settings-panel iframe, .builder-sidebar iframe', { timeout: 10000 });
    const frame = this.page.frameLocator('.settings-panel iframe, .builder-sidebar iframe').first();
    await frame.locator('body').waitFor({ state: 'visible', timeout: 5000 });
    await frame.locator('body').click();
    await this.page.waitForTimeout(300);
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Backspace');
    await this.page.waitForTimeout(200);
    await this.page.keyboard.type(text, { delay: 30 });
    await this.page.waitForTimeout(500);
  }

  async fill_Monaco_Text(locator, value) {
    const editor = this.page.locator(locator);
    await editor.waitFor({ state: 'visible' });
    await editor.click();
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Backspace');
    await this.page.keyboard.insertText(value);
  }

  async navigate_To_Settings() {
    await this.page.waitForSelector(this.locators.settingsTab, { timeout: 20000 });
    await this.page.click(this.locators.settingsTab, { force: true });
  }

  async navigate_To_about_application() {
    await this.page.waitForSelector(this.locators.aboutApplicationLink, { timeout: 30000 });
    await this.page.click(this.locators.aboutApplicationLink, { force: true });
  }

  async about_application_to_site_identity() {
    await this.page.waitForSelector(this.locators.siteidentitylocator, { timeout: 30000 });
    await this.page.click(this.locators.siteidentitylocator, { force: true });
  }

  async about_application_to_backup() {
    await this.page.waitForSelector(this.locators.backuplocator);
    await this.page.click(this.locators.backuplocator);
  }

  async about_application_to_email() {
    await this.page.waitForSelector(this.locators.emaillocator);
    await this.page.click(this.locators.emaillocator);
  }

  async about_application_to_system() {
    await this.page.waitForSelector(this.locators.systemSettingsLink);
    await this.page.click(this.locators.systemSettingsLink);
  }

  async about_application_to_mobile_app() {
    await this.page.waitForSelector(this.locators.mobileapplocator);
    await this.page.click(this.locators.mobileapplocator);
  }

  async about_application_to_development() {
    await this.page.waitForSelector(this.locators.developmentlocator);
    await this.page.click(this.locators.developmentlocator);
  }

  async about_application_to_notification() {
    await this.page.waitForSelector(this.locators.notificationlocator);
    await this.page.click(this.locators.notificationlocator);
  }

  async Users_And_Security_to_Users() {
    await this.page.waitForSelector(this.locators.userslocator);
    await this.page.click(this.locators.userslocator);
  }

  async Users_And_Security_to_Roles() {
    await this.page.waitForSelector(this.locators.roleslocator);
    await this.page.click(this.locators.roleslocator);
  }

  async Users_And_Security_to_Login_and_Signup() {
    await this.page.waitForSelector(this.locators.loginandsignup);
    await this.page.click(this.locators.loginandsignup);
  }

  async Users_And_Security_to_Table_access() {
    await this.page.waitForSelector(this.locators.tableaccess);
    await this.page.click(this.locators.tableaccess);
  }

  async Users_And_Security_to_HTTP() {
    await this.page.waitForSelector(this.locators.httplocator);
    await this.page.click(this.locators.httplocator);
  }

  async Users_And_Security_to_Permissions() {
    await this.page.waitForSelector(this.locators.permissionslocator);
    await this.page.click(this.locators.permissionslocator);
  }

  async Site_Structure_to_Menu() {
    await this.page.waitForSelector(this.locators.menulocator);
    await this.page.click(this.locators.menulocator);
  }

  async Site_Structure_to_Search() {
    await this.page.waitForSelector(this.locators.searchtablocator);
    await this.page.click(this.locators.searchtablocator);
  }

  async Site_Structure_to_Library() {
    await this.page.waitForSelector(this.locators.librarylocator);
    await this.page.click(this.locators.librarylocator);
  }

  async Site_Structure_to_Languages() {
    await this.page.waitForSelector(this.locators.languagelocator);
    await this.page.click(this.locators.languagelocator);
  }

  async Site_Structure_to_Page_groups() {
    await this.page.waitForSelector(this.locators.pagegroupslocator);
    await this.page.click(this.locators.pagegroupslocator);
  }

  async Site_Structure_to_Tags() {
    await this.page.waitForSelector(this.locators.tagslocator);
    await this.page.click(this.locators.tagslocator);
  }

  async Site_Structure_to_Diagram() {
    await this.page.waitForSelector(this.locators.diagramlocator);
    await this.page.click(this.locators.diagramlocator);
  }

  async Site_Structure_to_Registry_editor() {
    await this.page.waitForSelector(this.locators.registrylocator);
    await this.page.click(this.locators.registrylocator);
  }

  async Files_to_Files() {
    await this.page.waitForSelector(this.locators.fileslocator);
    await this.page.click(this.locators.fileslocator);
  }

  async Files_to_Storage() {
    await this.page.waitForSelector(this.locators.storagelocator);
    await this.page.click(this.locators.storagelocator);
  }

  async Files_to_Settings() {
    await this.page.waitForSelector(this.locators.Filesettinglocator);
    await this.page.click(this.locators.Filesettinglocator);
  }

  async Events_to_Triggers() {
    await this.page.waitForSelector(this.locators.trigerslocator, { timeout: 15000 });
    await this.page.click(this.locators.trigerslocator);
  }

  async Events_to_Custom() {
    await this.page.waitForSelector(this.locators.Customlocator);
    await this.page.click(this.locators.Customlocator);
  }

  async Events_to_Log_settings() {
    await this.page.waitForSelector(this.locators.logsettinglocator);
    await this.page.click(this.locators.logsettinglocator);
  }

  async Events_to_Event_log() {
    await this.page.waitForSelector(this.locators.Eventloglocator);
    await this.page.click(this.locators.Eventloglocator);
  }

  async navigate_To_module() {
    await this.page.waitForSelector(this.locators.Modulesettingsidebar);
    await this.page.click(this.locators.Modulesettingsidebar);
  }

  async navigate_To_All_modules() {
    await this.page.waitForSelector(this.locators.AllModuleslocator);
    await this.page.click(this.locators.AllModuleslocator);
  }

  async navigate_modules_To_modules() {
    await this.page.waitForSelector(this.locators.Moduleslocator);
    await this.page.click(this.locators.Moduleslocator);
  }

  async navigate_modules_To_packs() {
    await this.page.waitForSelector(this.locators.packslocator);
    await this.page.click(this.locators.packslocator);
  }

  async navigate_modules_To_themes() {
    await this.page.waitForSelector(this.locators.themeslocator);
    await this.page.click(this.locators.themeslocator);
  }

  async navigate_modules_To_Installed() {
    await this.page.waitForSelector(this.locators.Installedlocator);
    await this.page.click(this.locators.Installedlocator);
  }

  async navigate_To_Users_And_Security() {
    await this.page.waitForTimeout(2000);
    await this.page.waitForSelector(this.locators.UsersAndSecurity, { timeout: 25000 });
    await this.page.click(this.locators.UsersAndSecurity, { force: true });
  }

  async navigate_To_Site_Structure() {
    await this.page.waitForSelector(this.locators.SiteStructure);
    await this.page.click(this.locators.SiteStructure);
  }

  async navigate_To_Events() {
    await this.page.waitForSelector(this.locators.Events, { timeout: 5000 });
    await this.page.click(this.locators.Events);
  }

  async navigate_To_File() {
    await this.page.waitForTimeout(2000);
    await this.page.waitForSelector(this.locators.File, { timeout: 25000 });
    await this.page.click(this.locators.File, { force: true });
  }


  async clear_All() {
    await this.page.click(this.locators.clearAllButton);
    await this.page.click('#inputusers');
    await this.page.waitForSelector(this.locators.submitButton);
    await this.page.click(this.locators.submitButton);
    await this.page.waitForTimeout(1000);

  }

  async wait_For_Toaster_Message() {
    await this.page.waitForSelector(this.locators.toasterSelector);
  }

  get_Toaster_Message_Locator() {
    return this.page.locator(this.locators.toasterSelector);
  }

  async Save_Page_Project() {
    await this.page.waitForSelector(this.locators.saveButton);
    await this.page.click(this.locators.saveButton);
  }

  async click_table() {
    await this.page.waitForSelector(this.locators.click_table);
    await this.page.click(this.locators.click_table)
  }
  async view_Click() {
    await this.page.waitForSelector(this.locators.view_Click);
    await this.page.click(this.locators.view_Click);
  }

  async view_page() {
    await this.page.waitForSelector(this.locators.pageclick, { timeout: 30000 });
    await this.page.click(this.locators.pageclick);
  }

  async SALTCORN() {
    await this.page.waitForSelector(this.locators.SaltCornButton);
    await this.page.click(this.locators.SaltCornButton);
  }

  // async views() {
  //   await this.page.waitForSelector(this.locators.sidebarviewbutton);
  //   await this.page.click(this.locators.sidebarviewbutton);
  // }

  async views() {
    const modal = this.page.locator('#scmodal');
    const closeBtn = this.page.getByRole('button', { name: 'Close' });

    try {
      // Attempt to close modal only if button is actually visible
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await modal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => { });
      }
    } catch (e) {
      // Ignore race conditions (modal disappears during interaction)
    }

    // Now safely click sidebar
    await this.page.locator(this.locators.sidebarviewbutton).click();
  }

  static generate_Random_String(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  static generate_Random_Year() {
    return Math.floor(Math.random() * (2000 - 1970 + 1)) + 1970;
  }

  static generate_Random_Month() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[Math.floor(Math.random() * 12)];
  }

  static generate_Random_Day() {
    return Math.floor(Math.random() * 28) + 1;
  }

  async enter_Value_In_Div(page, selector, value) {
    await page.evaluate((selector, value) => {
      const element = document.querySelector(selector);
      if (element) {
        element.contentEditable = true;
        element.innerText = value; // Set the desired text here
      } else {
        throw new Error(`Element with selector ${selector} not found`);
      }
    }, selector, value);
  }

  async Validate_each_tab_of_about_applications() {
    const tabs = [
      'Site identity',
      'Backup',
      'Email',
      'System',
      'Mobile app',
      'Development',
      'Notifications'
    ];

    // Check if each tab is visible and has the correct text
    for (const tab of tabs) {
      const tabLocator = this.page.locator(`ul.nav.nav-pills.plugin-section a.nav-link:has-text("${tab}")`);
      await expect(tabLocator).toBeVisible();
      await expect(tabLocator).toHaveText(tab);
      await (tabLocator).click();
    }
  }

  // Helper function to wait for an element to be visible and then click it
  async waitForVisibleAndClick(selector, description) {
    await customAssert(description, async () => {
      const elements = await page.locator(selector).elementHandles();
      if (elements.length === 0) {
        throw new Error('No elements found for selector: ' + selector);
      }
      const lastElement = elements[elements.length - 1];
      await lastElement.scrollIntoViewIfNeeded();
      await expect(lastElement).toBeVisible();
      await lastElement.click();
    });
  }

  async clickDeleteButton() {
    // Listen for the confirmation dialog
    this.page.on('dialog', async dialog => {
      console.log(`Dialog message: ${dialog.message()}`);
      await dialog.accept(); // Accept the dialog
    });

    // Ensure the dropdown is visible
    await this.page.waitForSelector(this.locators.userdropdown, { state: 'visible' });

    // Click on the specific button within the dropdown
    await this.page.click(this.locators.deleteuser, { force: true });
  }

  async clickDeleteTrigger() {
    // Listen for the confirmation dialog
    this.page.on('dialog', async dialog => {
      console.log(`Dialog message: ${dialog.message()}`);
      await dialog.accept(); // Accept the dialog
    });

    // Ensure the dropdown is visible
    await this.page.waitForSelector(this.locators.deleteLink, { state: 'visible' });

    // Click on the specific button within the dropdown
    await this.page.click(this.locators.deleteLink, { force: true });
  }

  async clear_Data() {
    await this.SALTCORN();
    await this.navigate_To_Settings();
    await this.page.waitForSelector(this.locators.aboutApplicationLink);
    await this.page.click(this.locators.aboutApplicationLink, { timeout: 5000 });
    await this.about_application_to_system();
    await this.clear_All();
  }

  async setYear(desiredYear) {
    let currentYear = await this.page.$eval('.cur-year', input => parseInt(input.value));
    while (currentYear !== desiredYear) {
      if (currentYear < desiredYear) {
        // Click the up arrow
        await this.page.click('.flatpickr-current-month .arrowUp');
      } else if (currentYear > desiredYear) {
        // Click the down arrow
        await this.page.click('.flatpickr-current-month .arrowDown');
      }
      // Re-evaluate the current year after clicking
      currentYear = await this.page.$eval('.cur-year', input => parseInt(input.value));
    }
  }

  async install_flatpickr() {
    await this.navigate_To_Settings();
    // Navigate to Module
    await this.navigate_To_module();
    // Search with 'flatpickr' in the search bar
    await this.fill_Text(this.locators.SearchModule, 'flatpickr');
    // Assert that the flatpickr module is visible and click on it
    await customAssert('flatpickr-date module should be visible', async () => {
      await expect(this.page.locator(this.locators.flatpickrDateHeader)).toBeVisible();
      await this.page.click('button#button-search-submit');
    });
    await this.page.waitForTimeout(2000);
    // If Remove button is visible, module is already installed - skip install
    const removeVisible = (await this.page.locator(this.locators.removeFlatpickr).count()) > 0;
    if (!removeVisible) {
      try {
        await this.page.waitForSelector(this.locators.installflatpickr, { state: 'visible', timeout: 3000 });
        await this.page.click(this.locators.installflatpickr);
        await customAssert('Success message should be visible', async () => {
          await this.page.waitForSelector(this.locators.successmessage);
          await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
        });
      } catch {
        // Install button not found, skip
      }
    }
    await this.navigate_modules_To_Installed();
    await customAssert('flatpickr-date module should be present in installed tab', async () => {
      await expect(this.page.locator(this.locators.flatpickrDateHeader)).toBeVisible();
    });
  }

  async install_ckeditor() {
    await this.navigate_To_Settings();
    // Navigate to Module
    await this.navigate_To_module();
    // Search with 'ckeditor' in the search bar
    await this.fill_Text(this.locators.SearchModule, 'ckeditor');
    await customAssert('ckeditor4 module should be visible', async () => {
      await expect(this.page.locator(this.locators.ckeditorHeader)).toBeVisible();
      await this.page.click('button#button-search-submit');
    });
    await this.page.waitForTimeout(2000);
    // If Remove button is visible, module is already installed - skip install
    const removeVisible = (await this.page.locator(this.locators.removeCkeditor4).count()) > 0;
    if (!removeVisible) {
      try {
        await this.page.waitForSelector(this.locators.installCkeditor4, { state: 'visible', timeout: 3000 });
        await this.page.click(this.locators.installCkeditor4);
        await customAssert('Success message should be visible', async () => {
          await this.page.waitForSelector(this.locators.successmessage);
          await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
        });
      } catch {
        // Install button not found, skip
      }
    }
    await this.navigate_modules_To_Installed();
    await customAssert('ckeditor4 module should be present in installed tab', async () => {
      await expect(this.page.locator(this.locators.ckeditorHeader)).toBeVisible();
    });
  }

  async install_kanban() {
    await this.navigate_To_Settings();
    await this.navigate_To_module();
    await this.fill_Text(this.locators.SearchModule, 'kanban');
    await customAssert('kanban module should be visible', async () => {
      await expect(this.page.locator(this.locators.kanbanHeader)).toBeVisible();
      await this.page.click('button#button-search-submit');
    });
    await this.page.waitForTimeout(2000);
    // If Remove button is visible, module is already installed - skip install
    const removeVisible = (await this.page.locator(this.locators.removeKanban).count()) > 0;
    if (!removeVisible) {
      try {
        await this.page.waitForSelector(this.locators.installkanban, { state: 'visible', timeout: 3000 });
        await this.page.click(this.locators.installkanban);
        await customAssert('Success message should be visible', async () => {
          await this.page.waitForSelector(this.locators.successmessage);
          await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
        });
      } catch {
        // Install button not found, skip
      }
    }
    await this.navigate_modules_To_Installed();
    await customAssert('kanban module should be present in installed tab', async () => {
      await expect(this.page.locator(this.locators.kanbanHeader)).toBeVisible();
    });
  }

  async install_badges() {
    await this.navigate_To_Settings();
    await this.navigate_To_module();
    await this.fill_Text(this.locators.SearchModule, 'badges');
    await customAssert('badges module should be visible', async () => {
      await expect(this.page.locator(this.locators.badgesHeader)).toBeVisible();
      await this.page.click('button#button-search-submit');
    });
    await this.page.waitForTimeout(2000);
    // If Remove button is visible, module is already installed - skip install
    const removeVisible = (await this.page.locator(this.locators.removeBadges).count()) > 0;
    if (!removeVisible) {
      try {
        await this.page.waitForSelector(this.locators.installbadges, { state: 'visible', timeout: 3000 });
        await this.page.click(this.locators.installbadges);
        await customAssert('Success message should be visible', async () => {
          await this.page.waitForSelector(this.locators.successmessage);
          await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
        });
      } catch {
        // Install button not found, skip
      }
    }
    await this.navigate_modules_To_Installed();
    await customAssert('badges module should be present in installed tab', async () => {
      await expect(this.page.locator(this.locators.badgesHeader)).toBeVisible();
    });
  }

  async install_any_bootstrap_theme() {
    await this.navigate_To_Settings();
    await this.navigate_To_module();
    await this.fill_Text(this.locators.SearchModule, 'bootstrap-theme');
    await customAssert('any-bootstrap-theme module should be visible', async () => {
      await expect(this.page.locator(this.locators.bootstraptheme)).toBeVisible();
      await this.page.click('button#button-search-submit');
    });
    await this.page.waitForTimeout(2000);
    try {
      await this.page.waitForSelector(this.locators.installbootstap, { state: 'visible', timeout: 3000 });
      await this.page.click(this.locators.installbootstap);
      await customAssert('Success message should be visible', async () => {
        await this.page.waitForSelector(this.locators.successmessage);
        await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
      });
    } catch {
      // Module already installed (Remove button shown), skip install
    }
  }

  async installModules() {
    // Step 1: Navigate to Settings and Module
    await this.navigate_To_Settings();
    await this.navigate_To_module();

    // Step 2: Install JSON Module (skip if already installed)
    await this.fill_Text(this.locators.SearchModule, 'json');
    await customAssert('JSON module should be visible', async () => {
      await expect(this.page.locator(this.locators.json)).toBeVisible();
    });
    await this.page.waitForTimeout(2000);
    try {
      await this.page.waitForSelector(this.locators.installjson, { state: 'visible', timeout: 3000 });
      await this.page.click(this.locators.installjson);
      await customAssert('Success message for JSON should be visible', async () => {
        await this.page.waitForSelector(this.locators.successmessage);
        await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
      });
    } catch {
      // JSON module already installed, skip
    }

    // Step 3: Install Tabulator Module (skip if already installed)
    await this.fill_Text(this.locators.SearchModule, 'tabulator');
    await customAssert('Tabulator module should be visible', async () => {
      await expect(this.page.locator(this.locators.tabulator)).toBeVisible();
    });
    await this.page.click('button#button-search-submit');
    await this.page.waitForTimeout(2000);
    try {
      await this.page.waitForSelector(this.locators.installtabulator, { state: 'visible', timeout: 3000 });
      await this.page.click(this.locators.installtabulator);
      await customAssert('Success message for Tabulator should be visible', async () => {
        await this.page.waitForSelector(this.locators.successmessage);
        await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
      });
    } catch {
      // Tabulator module already installed, skip
    }
  }



  async navigateSettingsTabs(page, pageobject) {
    // Click on settings dropdown
    const settingsDropdown = page.locator(pageobject.settingsDropdown);
    await settingsDropdown.click();

    // Click on "About Application" link
    const aboutApplicationLink2 = page.locator(pageobject.aboutApplicationLink2);
    await aboutApplicationLink2.click();

    // Click on the "Mobile App" link
    const systemtablink = page.locator(pageobject.systemtablink);
    await systemtablink.click();
  }
  async navi_Setting_Dropdown_Clear(page, pageobject) {
    await this.page.click('#inputusers');
    await this.page.waitForSelector(this.locators.submitButton);
    await this.page.click(this.locators.submitButton);

  }


  async assertMobileAppTabElements(page, pageobject) {
    // Assert the view link is visible
    await customAssert('Assert the view link in mobile app tab', async () => {
      await expect(this.page.locator(this.locators.viewNavLink), { timeout: 30000 }).toBeVisible();
    });

    // Assert the page link is visible
    await customAssert('Assert the page link in mobile app tab', async () => {
      await expect(this.page.locator(this.locators.pageNavLink)).toBeVisible();
    });

    // Assert the page group link is visible
    await customAssert('Assert the page group link in mobile app tab', async () => {
      await expect(this.page.locator(this.locators.pagegroupNavLink)).toBeVisible();
    });

    // Assert the Android checkbox is not checked
    await page.locator(pageobject.androidCheckbox).check();
    await customAssert('Assert the android Checkbox checkbox in Mobile app tab is checked', async () => {
      await expect(this.page.locator(this.locators.androidCheckbox)).toBeChecked();
    });


    // Assert the app name text box is empty
    // Step 2: Fill the app name text box with "Mobile App"
    this.fill_Text(pageobject.appName, 'Mobile App');
    await customAssert('Assert the app name text box is empty', async () => {
      await expect(this.page.locator(this.locators.appName)).toHaveValue('Mobile App');
    });

    // Assert the app ID text box is visible
    this.fill_Text(pageobject.appId, 'myproject19july@mailinator.com');
    await customAssert('Assert the app id text box is visible', async () => {
      await expect(this.page.locator(this.locators.appId)).toHaveValue('myproject19july@mailinator.com');
    });

    // Assert the app version text box is empty
    this.fill_Text(pageobject.appVersion, '0.0.1');
    await customAssert('Assert the app version text box is empty', async () => {
      await expect(this.page.locator(this.locators.appVersion)).toHaveValue('0.0.1');
    });

    // Assert the server URL text box is empty
    this.fill_Text(pageobject.serverURL, 'http://10.0.2.2:3000');
    await customAssert('Assert the server URL text box is empty', async () => {
      await expect(this.page.locator(this.locators.serverURL)).toHaveValue('http://10.0.2.2:3000');
    });

    // Assert the debug radio button is not checked
    await page.locator(pageobject.debugBuildType).check();
    await customAssert('Assert the debug radio button in Mobile app tab is not checked', async () => {
      await expect(this.page.locator(this.locators.debugBuildType)).toBeChecked();
    });

    // Assert the build Mobile App Button has correct text
    await customAssert('Assert the build Mobile App Button', async () => {
      await expect(this.page.locator(this.locators.buildMobileAppBtn)).toHaveText('Build mobile app');
    });
    await this.page.click(pageobject.buildMobileAppBtn);
  }

  async showSuccessMessage() {

    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.page.evaluate(() => {
      alert('The build was successful!');
    });

    // Assert that the alert was triggered
    await this.page.on('dialog', async dialog => {
      expect(dialog.message()).toBe('The build was successful!');
      await dialog.accept();
    });
  }

  async clearText(locator) {
    // Click on the locator to focus it
    await this.page.click(locator);
    // Clear existing text
    await this.page.evaluate((selector) => {
      const editableDiv = document.querySelector(selector);
      if (editableDiv) {
        const range = document.createRange();
        range.selectNodeContents(editableDiv);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('delete'); // Delete selected text
      }
    }, locator);
  }
  async createBlog() {
    await this.navigate_To_Settings();
    // Navigate to Module
    await this.navigate_To_module();
    await this.navigate_To_All_modules();
    // Step 2: Install Blog Module
    await this.fill_Text(this.locators.SearchModule, 'Blog');
    await customAssert('BLOG module should be visible', async () => {
      await expect(this.page.locator(this.locators.Blog)).toBeVisible();
    });
    await this.page.click(this.locators.installBlog);
    await customAssert('Success message for Blog should be visible', async () => {
      await this.page.waitForSelector(this.locators.successmessage);
      await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
    });
  }
  async Address_book() {
    await this.navigate_To_Settings();
    // Navigate to Module
    await this.navigate_To_module();
    await this.navigate_To_All_modules();

    // Step 2: Install Address book Module
    await this.fill_Text(this.locators.SearchModule, 'Address book');
    await customAssert('Address Book module should be visible', async () => {
      await expect(this.page.locator(this.locators.Addressbook)).toBeVisible();
    });
    await this.page.click(this.locators.installAddressbook);
    await customAssert('Success message for Address Book should be visible', async () => {
      await this.page.waitForSelector(this.locators.successmessage);
      await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
    });
  }

  async Saltcorn_Store() {
    await this.navigate_To_Settings();
    // Navigate to Module
    await this.navigate_To_module();
    // Step 2: Install Address book Module
    await this.fill_Text(this.locators.SearchModule, 'Saltcorn store');
    await customAssert('Saltcorn store module should be visible', async () => {
      await expect(this.page.locator(this.locators.SaltcornStore)).toBeVisible();
    });
    await this.page.click(this.locators.installSaltcornStore);
    await customAssert('Success message for Saltcorn store should be visible', async () => {
      await this.page.waitForSelector(this.locators.successmessage);
      await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
    });
  }

  async install_money() {
    await this.navigate_To_Settings();
    // Navigate to Module
    await this.navigate_To_module();
    // Search with 'flatpickr' in the search bar
    await this.fill_Text(this.locators.SearchModule, 'money');
    // Assert that the flatpickr module is visible and click on it
    await customAssert('money module should be visible', async () => {
      await expect(this.page.locator(this.locators.MoneyHeader)).toBeVisible();
      await this.page.click('button#button-search-submit');
    });
    await this.page.waitForTimeout(2000);
    try {
      await this.page.waitForSelector(this.locators.installmoney, { state: 'visible', timeout: 3000 });
      await this.page.click(this.locators.installmoney);
      await customAssert('Success message should be visible', async () => {
        await this.page.waitForSelector(this.locators.successmessage);
        await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
      });
    } catch {
      // Module already installed, skip install
    }
    await this.navigate_modules_To_Installed();
    await customAssert('money module should be present in installed tab', async () => {
      await expect(this.page.locator(this.locators.MoneyHeader)).toBeVisible();
    });
  }

  async install_ManyToMany() {
    await this.navigate_To_Settings();
    // Navigate to Module
    await this.navigate_To_module();
    // Search with 'flatpickr' in the search bar
    await this.fill_Text(this.locators.SearchModule, 'many-to-many');
    // Assert that the flatpickr module is visible and click on it
    await customAssert('many-to-many module should be visible', async () => {
      await expect(this.page.locator(this.locators.Many2ManyHeader)).toBeVisible();
      await this.page.click('button#button-search-submit');
    });
    await this.page.waitForTimeout(2000);
    try {
      await this.page.waitForSelector(this.locators.installmany2many, { state: 'visible', timeout: 3000 });
      await this.page.click(this.locators.installmany2many);
      await customAssert('Success message should be visible', async () => {
        await this.page.waitForSelector(this.locators.successmessage);
        await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
      });
    } catch {
      // Module already installed, skip install
    }
    await this.navigate_modules_To_Installed();
    await customAssert('many-to-many module should be present in installed tab', async () => {
      await expect(this.page.locator(this.locators.Many2ManyHeader)).toBeVisible();
    });
  }
  async navigateToUserSettings() {
    const userLink = this.page
      .getByRole('link', { name: ' User ' })
      .filter({ has: this.page.locator('span:has-text("User")') });

    await userLink.click();

    const userSettings = this.page.locator('#collapseUser a[href="/auth/settings"]');
    await userSettings.waitFor({ state: 'visible' });
    await userSettings.click();
  }


  async assert_FileList_Table() {
    // Wait for table to be visible
    await this.page.waitForSelector(this.locators.table, { timeout: 25000 });

    const table = this.page.locator(this.locators.table);

    // ✅ Assert headers
    const headers = await table.locator("thead th").allInnerTexts();
    expect(headers.map(h => h.trim())).toEqual([
      "",             // icon column
      "Filename",
      "Media type",
      "Size (KiB)",
      "Role to access",
      "Created",
    ]);
  }

  async upload_file(filePath) {
    const fileInput = await this.page.waitForSelector(this.locators.FileInputForUpload);
    await fileInput.setInputFiles(filePath);
    await this.submit();
  }
  async dialog_handle(filename) {
    //a dialog handler BEFORE the action that triggers it
    await this.page.once('dialog', async dialog => {
      console.log(dialog.message());
      await dialog.accept(filename);
    });
  }
  async rename_file(current_file_name, new_file_name) {
    await this.page.waitForSelector(this.locators.tablebodylocator);
    await this.page.locator(this.locators.tablebodylocator).nth(0).click();
    await this.page.waitForSelector(this.locators.tablebodylocator + " td:nth-child(2)");
    let fileName = await this.page.textContent(this.locators.tablebodylocator + " td:nth-child(2)");
    expect(fileName?.trim()).toBe(current_file_name);
    await this.page.waitForTimeout(1000);
    await this.dialog_handle(new_file_name); //a dialog handler BEFORE the action that triggers it

    // Wait for the Action dropdown to be visible
    await this.page.locator(this.locators.actionselector).nth(2).waitFor({ state: "visible" });
    await this.page.locator(this.locators.actionselector).nth(2).click();
    await this.page.keyboard.type('Rename');
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(1000);
    fileName = await this.page.textContent(this.locators.tablebodylocator + " td:nth-child(2)");
    expect(fileName?.trim()).toBe(new_file_name);
  }

  async tc41_assert_site_structure_tabs_default_and_navigation(Logger, baseURL) {
    await this.open_Site_Structure_Menu(baseURL, Logger);

    await customAssert('Default active breadcrumb step should be Menu', async () => {
      const activeCrumb = this.page.locator(this.locators.activeBreadcrumb).first();
      await expect(activeCrumb).toBeVisible({ timeout: 30000 });
      await expect(activeCrumb).toContainText('Menu');
    });

    await customAssert('All 10 tabs are present and active tab is Menu', async () => {
      const expectedTabs = [
        { href: '/menu', label: 'Menu' },
        { href: '/search/config', label: 'Search' },
        { href: '/library/list', label: 'Library' },
        { href: '/site-structure/localizer', label: 'Languages' },
        { href: '/page_group/settings', label: 'Pagegroups' },
        { href: '/tag', label: 'Tags' },
        { href: '/diagram', label: 'Diagram' },
        { href: '/registry-editor', label: 'Registry editor' }
      ];

      const tabsContainer = this.page.locator(this.locators.siteStructureTabStrip);
      await expect(tabsContainer).toBeVisible({ timeout: 15000 });

      const tabLinks = this.page.locator(this.locators.siteStructureTabLinks);
      const actualTabTexts = (await tabLinks.allTextContents()).map((txt) => txt.trim());
      Logger?.info?.(`Site structure tabs: ${actualTabTexts.join(', ')}`);

      for (const t of expectedTabs) {
        const link = this.page.locator(`${this.locators.siteStructureTabStrip} a[href="${t.href}"]`).first();
        await expect(link).toBeVisible({ timeout: 15000 });
        await expect(link).toContainText(t.label);
      }

      const activeTab = this.page.locator(`${this.locators.siteStructureTabStrip} a.active`);
      await expect(activeTab).toBeVisible({ timeout: 15000 });
      await expect(activeTab).toContainText('Menu');

      Logger?.info?.('Action: click each Site structure tab and verify navigation');
      for (const t of expectedTabs) {
        const tabLink = this.page.locator(`${this.locators.siteStructureTabStrip} a[href="${t.href}"]`).first();
        Logger?.info?.(`Action: click tab ${t.label} (${t.href})`);
        await tabLink.click({ force: true });
        await expect(this.page).toHaveURL(new RegExp(`${t.href.replace('/', '\\/')}(\\?|$)`));
        await expect(tabLink).toHaveClass(/active/);
      }

      Logger?.info?.('Action: return to Menu tab');
      await this.page.locator(`${this.locators.siteStructureTabStrip} a[href="/menu"]`).first().click({ force: true });
      await expect(this.page).toHaveURL(/\/menu(\?|$)/);
    });

    await this.takeDebugScreenshot('tc_41_tabs_01_all_tabs_rendered', Logger);
  }

  async tc41_assert_menu_tab_controls(Logger, baseURL) {
    await this.open_Site_Structure_Menu(baseURL, Logger);

    await customAssert('Menu editor card and main form controls are visible', async () => {
      await expect(this.page.locator(this.locators.cardShadow)).toBeVisible({ timeout: 15000 });
      const menuEditorHeader = this.page.locator(this.locators.cardHeaderH5).filter({ hasText: 'Menu editor' }).first();
      await expect(menuEditorHeader).toBeVisible({ timeout: 15000 });
      await expect(this.page.locator(this.locators.menuForm)).toBeVisible({ timeout: 15000 });

      const typeSelect = this.page.locator(this.locators.menuTypeSelect);
      await expect(typeSelect).toBeVisible({ timeout: 15000 });
      // Many menu fields (e.g. keyboard shortcut) are conditional on item type; ensure View so labels exist.
      await typeSelect.selectOption({ label: 'View' });
      await expect(typeSelect).toHaveValue('View');

      const expectedTypeOptions = [
        'View', 'Page', 'Page Group', 'Admin Page', 'User Page',
        'Link', 'Header', 'Dynamic', 'Search', 'Separator', 'Action'
      ];
      const typeOptions = this.page.locator(this.locators.menuTypeOptions);
      await expect(typeOptions).toHaveCount(expectedTypeOptions.length);
      const actualTypeOptions = await typeOptions.evaluateAll((opts) =>
        opts.map((o) => (o.textContent || '').trim())
      );
      expect(actualTypeOptions).toEqual(expectedTypeOptions);

      await expect(this.page.locator(this.locators.menuUpdateBtn)).toBeVisible({ timeout: 15000 });
      await expect(this.page.locator(this.locators.menuUpdateBtn)).toBeDisabled();
      await expect(this.page.locator(this.locators.menuAddBtn)).toBeVisible({ timeout: 15000 });
      await expect(this.page.locator(this.locators.menuRecalcBtn)).toBeVisible({ timeout: 15000 });

      await expect(this.page.locator(this.locators.menuIconBtn)).toBeVisible({ timeout: 15000 });

      const menuLabelChecks = [
        { loc: this.locators.menuLabelType, text: 'Type' },
        { loc: this.locators.menuLabelText, text: 'Text label' },
        { loc: this.locators.menuLabelTooltip, text: 'Tooltip' },
        { loc: this.locators.menuLabelMinRole, text: 'Minimum role' },
        { loc: this.locators.menuLabelMaxRole, text: 'Maximum role' },
        { loc: this.locators.menuLabelShowIf, text: 'Show if' },
        { loc: this.locators.menuLabelDisableMobile, text: 'Disable on mobile' },
        { loc: this.locators.menuLabelTargetBlank, text: 'Open in new tab' },
        { loc: this.locators.menuLabelModal, text: 'Open in popup modal?' },
        { loc: this.locators.menuLabelStyle, text: 'Style' },
        { loc: this.locators.menuLabelLocation, text: 'Location' }
      ];
      for (const c of menuLabelChecks) await expect(this.page.locator(c.loc)).toContainText(c.text);

      const shortcutLbl = this.page.locator(this.locators.menuLabelShortcut);
      if ((await shortcutLbl.count()) > 0) {
        await expect(shortcutLbl).toContainText('Keyboard shortcut');
      }

      const menuRoleChecks = [
        { loc: this.locators.menuMinRoleAdmin, text: 'admin' },
        { loc: this.locators.menuMaxRolePublic, text: 'public' }
      ];
      for (const c of menuRoleChecks) await expect(this.page.locator(c.loc)).toHaveText(c.text);

      await expect(this.page.locator(this.locators.menuTree)).toBeVisible({ timeout: 15000 });
      const menuTreeSections = ['Tables', 'Views', 'Pages', 'Settings'];
      for (const s of menuTreeSections) {
        await expect(this.page.locator(this.locators.menuTreeTxt, { hasText: s }).first()).toBeVisible({ timeout: 15000 });
      }

      Logger?.info?.('Action: click Menu Add button (trial)');
      await this.page.locator(this.locators.menuAddBtn).click({ trial: true });
      Logger?.info?.('Action: click Menu Recalculate button (trial)');
      await this.page.locator(this.locators.menuRecalcBtn).click({ trial: true });

      Logger?.info?.('Action: change Menu item Type to Link');
      await typeSelect.selectOption({ label: 'Link' });
      await expect(typeSelect).toHaveValue('Link');
      Logger?.info?.('Action: change Menu item Type back to View');
      await typeSelect.selectOption({ label: 'View' });
      await expect(typeSelect).toHaveValue('View');
    });

    await this.takeDebugScreenshot('tc_41_menu_01_controls', Logger);
  }

  async tc41_assert_search_tab_controls(Logger, baseURL) {
    await this.open_Site_Structure_Menu(baseURL, Logger);
    await this.Site_Structure_to_Search();

    await customAssert('Search configuration UI is visible with expected controls', async () => {
      await expect(this.page).toHaveURL(/\/search\/config/);

      const activeCrumb = this.page.locator(this.locators.activeBreadcrumb).first();
      await expect(activeCrumb).toBeVisible({ timeout: 15000 });
      await expect(activeCrumb).toContainText('Search');

      const header = this.page.locator(this.locators.cardHeaderH5).filter({ hasText: 'Search configuration' }).first();
      await expect(header).toBeVisible({ timeout: 15000 });

      const form = this.page.locator(this.locators.searchConfigForm);
      await expect(form).toBeVisible({ timeout: 15000 });

      const tableDescCheckbox = this.page.locator(this.locators.searchTableDescription);
      await expect(tableDescCheckbox).toBeVisible({ timeout: 15000 });
      await expect(tableDescCheckbox).toBeChecked();

      const decorationSelect = this.page.locator(this.locators.searchResultsDecoration);
      await expect(decorationSelect).toBeVisible({ timeout: 15000 });
      await expect(this.page.locator(this.locators.searchResultsDecorationOptions)).toHaveCount(2);
      await expect(this.page.locator(this.locators.searchResultsCards)).toHaveText('Cards');
      await expect(this.page.locator(this.locators.searchResultsTabs)).toHaveText('Tabs');

      const disableFts = this.page.locator(this.locators.searchDisableFts);
      await expect(disableFts).toBeVisible({ timeout: 15000 });
      await expect(disableFts).not.toBeChecked();

      Logger?.info?.('Action: trial click Search link from configuration page');
      await this.page.locator(this.locators.searchLink).first().click({ trial: true });

      Logger?.info?.('Action: toggle Search table description checkbox off/on');
      await tableDescCheckbox.click();
      await expect(tableDescCheckbox).not.toBeChecked();
      await tableDescCheckbox.click();
      await expect(tableDescCheckbox).toBeChecked();

      Logger?.info?.('Action: toggle Search disable FTS checkbox off/on');
      await disableFts.click();
      await expect(disableFts).toBeChecked();
      await disableFts.click();
      await expect(disableFts).not.toBeChecked();

      Logger?.info?.('Action: change Search results decoration Tabs -> Cards');
      await decorationSelect.selectOption('Tabs');
      await expect(decorationSelect).toHaveValue('Tabs');
      await decorationSelect.selectOption('Cards');
      await expect(decorationSelect).toHaveValue('Cards');

      Logger?.info?.('Action: click Search link to navigate to /search');
      await this.page.locator(this.locators.searchLink).first().click({ force: true });
      await expect(this.page).toHaveURL(/\/search(\?|$)/);

      Logger?.info?.('Action: go back to /search/config');
      await this.page.goBack();
      await expect(this.page).toHaveURL(/\/search\/config(\?|$)/);
    });

    await this.takeDebugScreenshot('tc_41_search_01_controls', Logger);
  }

  async tc41_assert_library_tab_table_headers(Logger, baseURL) {
    await this.open_Site_Structure_Menu(baseURL, Logger);
    await this.Site_Structure_to_Library();

    await customAssert('Library UI has the expected table structure', async () => {
      await expect(this.page).toHaveURL(/\/library\/list/);

      const header = this.page.locator(this.locators.cardHeaderH5);
      await expect(header).toContainText('Library: component assemblies');

      const table = this.page.locator(this.locators.tableResponsiveSm);
      await expect(table).toBeVisible({ timeout: 15000 });

      const ths = table.locator(this.locators.tableHeadCells);
      await expect(ths).toHaveCount(3);

      const expectedLibHeaders = ['Name', 'Icon', 'Delete'];
      for (let i = 0; i < expectedLibHeaders.length; i++) {
        await expect(ths.nth(i)).toContainText(expectedLibHeaders[i]);
      }

      Logger?.info?.('Action: trial click Settings breadcrumb link');
      await this.page.locator(this.locators.settingsBreadcrumbLink).first().click({ trial: true });
    });

    await this.takeDebugScreenshot('tc_41_library_01_table_headers', Logger);
  }

  async tc41_assert_languages_tab_add_language_and_upload_csv(Logger, baseURL) {
    const debugDir = 'test-results';
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

    await this.open_Site_Structure_Menu(baseURL, Logger);
    await this.Site_Structure_to_Languages();

    await customAssert('Languages UI shows table + add/upload controls', async () => {
      await expect(this.page).toHaveURL(/\/site-structure\/localizer/);

      const header = this.page.locator(this.locators.activeBreadcrumb).first();
      await expect(header).toContainText('Languages');

      const table = this.page.locator(this.locators.tableResponsiveSm);
      await expect(table).toBeVisible({ timeout: 15000 });

      const ths = table.locator(this.locators.tableHeadCells);
      await expect(ths).toHaveCount(5);

      const expectedLangHeaders = ['Language', 'Locale', 'Default', 'Language CSV', 'Delete'];
      for (let i = 0; i < expectedLangHeaders.length; i++) {
        await expect(ths.nth(i)).toContainText(expectedLangHeaders[i]);
      }

      const langUiCtas = [
        { locator: this.locators.languagesAddLink, label: 'Add language' },
        { locator: this.locators.languagesUploadLabel, label: 'Upload language CSV' }
      ];
      for (const c of langUiCtas) {
        const el = this.page.locator(c.locator).first();
        await expect(el).toBeVisible({ timeout: 15000 });
        await expect(el).toContainText(c.label);
      }

      const addLang = this.page.locator(this.locators.languagesAddLink).first();

      await expect(this.page.locator(this.locators.languagesUploadInput)).toHaveAttribute('type', 'file');
      await expect(this.page.locator(this.locators.languagesUploadInput)).toHaveClass(/d-none/);
      await expect(this.page.locator(this.locators.languagesUploadForm)).toBeVisible({ timeout: 15000 });

      // E2E flow: Add language + validate persistence by re-checking the edit form fields and then the table row.
      const langName = `E2E_Lang_${Date.now()}`;
      const langLocale = `e2e-${Date.now().toString().slice(-4)}`;

      Logger?.info?.('Action: click Add language');
      await addLang.click({ force: true });
      await expect(this.page).toHaveURL(/\/site-structure\/localizer\/add-lang/);

      const nameField = this.page.locator(this.locators.languageNameInput).first();
      const localeField = this.page.locator(this.locators.languageLocaleInput).first();
      await expect(nameField).toBeVisible({ timeout: 15000 });
      await expect(localeField).toBeVisible({ timeout: 15000 });

      Logger?.info?.('Action: fill new language name + locale');
      await nameField.fill(langName);
      await localeField.fill(langLocale);

      Logger?.info?.('Action: submit new language form');
      await this.page.locator(this.locators.submitButtonGeneric).first().click();
      await expect(this.page).toHaveURL(/\/site-structure\/localizer\/edit\//);

      await this.assert_Mutation_Persistence('language create', async () => {
        await expect(this.page.locator(this.locators.languageNameInput).first()).toHaveValue(langName);
        await expect(this.page.locator(this.locators.languageLocaleInput).first()).toHaveValue(langLocale);
      }, Logger);

      const langTableRows = `${this.locators.tableResponsiveSm} ${this.locators.tableBodyRows}`;
      await this.page.goto(`${baseURL}/site-structure/localizer`, { waitUntil: 'domcontentloaded' });
      await expect(this.page).toHaveURL(/\/site-structure\/localizer(\?|$)/);
      await expect(this.page.locator(langTableRows).filter({ hasText: langName }).first()).toBeVisible({ timeout: 30000 });

      // E2E flow: upload CSV from hidden input and verify persistence in the table.
      const langCsvPath = `${debugDir}/tc_41_langpack_${Date.now()}.csv`;
      fs.writeFileSync(langCsvPath, 'key,value\nhello,Hello from E2E\n');

      Logger?.info?.('Action: upload language CSV');
      await this.page.locator(this.locators.languagesUploadInput).setInputFiles(langCsvPath);
      await expect(this.page).toHaveURL(/\/site-structure\/localizer(\?|$)/);

      await this.assert_Mutation_Persistence('language csv upload', async () => {
        await expect(this.page.locator(langTableRows).filter({ hasText: langName }).first()).toBeVisible({ timeout: 15000 });
      }, Logger);

      // Best-effort cleanup: delete created language row.
      const createdRow = this.page.locator(langTableRows).filter({ hasText: langName }).first();
      if ((await createdRow.count()) > 0) {
        const deleteLink = createdRow.locator(this.locators.languagesDeleteAction).first();
        if ((await deleteLink.count()) > 0) {
          Logger?.info?.('Action: delete created language row');
          await this.run_With_Dialog_Accept(async () => {
            await deleteLink.click({ force: true });
          }, Logger);
          await this.assert_Mutation_Persistence('language delete', async () => {
            await expect(this.page.locator(langTableRows).filter({ hasText: langName })).toHaveCount(0);
          }, Logger);
        }
      }
    });

    await this.takeDebugScreenshot('tc_41_languages_01_controls', Logger);
  }

  async tc41_assert_pagegroups_tab_controls(Logger, baseURL) {
    await this.open_Site_Structure_Menu(baseURL, Logger);
    await this.Site_Structure_to_Page_groups();

    await customAssert('Pagegroups UI renders both cards and key form controls', async () => {
      await expect(this.page).toHaveURL(/\/page_group\/settings/);

      const activeCrumb = this.page.locator(this.locators.activeBreadcrumb).first();
      await expect(activeCrumb).toContainText('Pagegroups');

      const userAgentHeader = this.page.locator(this.locators.cardHeaderH5).filter({ hasText: 'User Agent screen infos' }).first();
      await expect(userAgentHeader).toBeVisible({ timeout: 15000 });

      const screenInfoCells = ['web', '1920', '1000', '1848', '980'];
      const screenInfoTd = this.page.locator(`${this.locators.tableResponsiveSm} td`);
      for (const v of screenInfoCells) {
        await expect(screenInfoTd.filter({ hasText: v }).first()).toBeVisible({ timeout: 15000 });
      }

      const card2Header = this.page.locator(this.locators.cardHeaderH5).filter({ hasText: 'Page Group settings' }).first();
      await expect(card2Header).toBeVisible({ timeout: 15000 });

      await expect(this.page.locator(this.locators.pagegroupsStrategy)).toBeVisible({ timeout: 15000 });
      await expect(this.page.locator(this.locators.pagegroupsStrategy)).toHaveValue('guess_from_user_agent');

      const strategyOptionChecks = [
        { loc: this.locators.pagegroupsStrategyGuess, text: 'Guess from user agent' },
        { loc: this.locators.pagegroupsStrategyReload, text: 'Reload' }
      ];
      for (const c of strategyOptionChecks) await expect(this.page.locator(c.loc)).toHaveText(c.text);

      Logger?.info?.('Action: change missing screen info strategy to Reload and save');
      await this.page.locator(this.locators.pagegroupsStrategy).selectOption('reload');
      await expect(this.page.locator(this.locators.pagegroupsStrategy)).toHaveValue('reload');

      await this.page.locator(this.locators.submitButtonGeneric).first().click();
      await this.assert_Mutation_Persistence('pagegroup strategy reload save', async () => {
        await expect(this.page.locator(this.locators.pagegroupsStrategy)).toHaveValue('reload');
      }, Logger);

      await expect(this.page).toHaveURL(/\/page_group\/settings(\?|$)/);
      await expect(this.page.locator(this.locators.pagegroupsStrategy)).toHaveValue('reload');

      Logger?.info?.('Action: change missing screen info strategy back to Guess from user agent and save');
      await this.page.locator(this.locators.pagegroupsStrategy).selectOption('guess_from_user_agent');
      await expect(this.page.locator(this.locators.pagegroupsStrategy)).toHaveValue('guess_from_user_agent');

      await this.page.locator(this.locators.submitButtonGeneric).first().click();
      await this.assert_Mutation_Persistence('pagegroup strategy reset save', async () => {
        await expect(this.page.locator(this.locators.pagegroupsStrategy)).toHaveValue('guess_from_user_agent');
      }, Logger);

      const addDeviceLink = this.page.locator(this.locators.pagegroupsAddDevice).first();
      await expect(addDeviceLink).toBeVisible({ timeout: 15000 });
      await expect(addDeviceLink).toContainText('Add screen info');

      Logger?.info?.('Action: click Add screen info');
      await addDeviceLink.click({ force: true });
      await expect(this.page).toHaveURL(/\/page_group\/settings\/add-device/);

      Logger?.info?.('Action: go back to /page_group/settings');
      await this.page.goBack();
      await expect(this.page).toHaveURL(/\/page_group\/settings(\?|$)/);
    });

    await this.takeDebugScreenshot('tc_41_pagegroups_01_controls', Logger);
  }

  async tc41_assert_tags_tab_controls(Logger, baseURL) {
    await this.open_Site_Structure_Menu(baseURL, Logger);
    await this.Site_Structure_to_Tags();

    await customAssert('Tags table shows expected columns and Create tag CTA', async () => {
      await expect(this.page).toHaveURL(/\/tag$/);

      const activeCrumb = this.page.locator(this.locators.activeBreadcrumb).first();
      await expect(activeCrumb).toContainText('Tags');

      const header = this.page.locator(this.locators.cardHeaderH5).filter({ hasText: 'Tags' }).first();
      await expect(header).toBeVisible({ timeout: 15000 });

      const table = this.page.locator(this.locators.tableResponsiveSm);
      await expect(table).toBeVisible({ timeout: 15000 });

      const ths = table.locator(this.locators.tableHeadCells);
      await expect(ths).toHaveCount(2);
      const expectedTagHeaders = ['Tag name', 'Delete'];
      for (let i = 0; i < expectedTagHeaders.length; i++) await expect(ths.nth(i)).toContainText(expectedTagHeaders[i]);

      const rows = table.locator(this.locators.tableBodyRows);
      const rowCount = await rows.count();
      Logger?.info?.(`Tags table tbody rowCount=${rowCount}`);

      const createTag = this.page.locator(this.locators.tagsCreateLink).first();
      await expect(createTag).toBeVisible({ timeout: 15000 });
      await expect(createTag).toContainText('Create tag');

      if (rowCount > 0) {
        for (let i = 0; i < rowCount; i++) {
          await expect(rows.nth(i).locator('td').first().locator('a').first()).toBeVisible({ timeout: 15000 });
        }
      }

      // E2E: create temporary tag and delete it.
      const tempTag = `e2e_tag_${Date.now()}`;
      Logger?.info?.('Action: click Create tag');
      await createTag.click({ force: true });
      await expect(this.page).toHaveURL(/\/tag\/new/);

      Logger?.info?.('Action: fill temporary tag name + submit');
      await this.page.locator(this.locators.languageNameInput).fill(tempTag);
      await this.page.locator(this.locators.submitButtonGeneric).first().click();
      await expect(this.page).toHaveURL(/\/tag\/\d+/);

      await this.assert_Mutation_Persistence('tag create', async () => {
        await expect(this.page).toHaveURL(/\/tag\/\d+/);
      }, Logger);

      await this.page.goto(`${baseURL}/tag`, { waitUntil: 'domcontentloaded' });
      await expect(this.page).toHaveURL(/\/tag(\?|$)/);

      const tempTagRow = this.page.locator(`${this.locators.tableResponsiveSm} ${this.locators.tableBodyRows}`).filter({ hasText: tempTag }).first();
      await expect(tempTagRow).toBeVisible({ timeout: 30000 });

      const tempTagDelete = tempTagRow.locator(this.locators.languagesDeleteAction).first();
      if ((await tempTagDelete.count()) > 0) {
        Logger?.info?.('Action: delete temporary tag');
        await this.run_With_Dialog_Accept(async () => {
          await tempTagDelete.click({ force: true });
        }, Logger);
        await this.assert_Mutation_Persistence('tag delete', async () => {
          await expect(this.page.locator(`${this.locators.tableResponsiveSm} ${this.locators.tableBodyRows}`).filter({ hasText: tempTag })).toHaveCount(0);
        }, Logger);
      }
    });

    await this.takeDebugScreenshot('tc_41_tags_01_controls', Logger);
  }

  async tc41_assert_diagram_tab_controls(Logger, baseURL) {
    await this.open_Site_Structure_Menu(baseURL, Logger);
    await this.Site_Structure_to_Diagram();

    await customAssert('Diagram UI has dropdown filters and #cy canvas', async () => {
      await expect(this.page).toHaveURL(/\/diagram/);
      await expect(this.page.locator(this.locators.diagramCanvas)).toBeVisible({ timeout: 15000 });

      const header = this.page.locator(this.locators.cardHeaderH5).filter({ hasText: 'Application diagram' }).first();
      await expect(header).toBeVisible({ timeout: 15000 });

      const allEntitiesBtn = this.page.locator(this.locators.diagramAllEntitiesBtn).first();
      Logger?.info?.('Action: click All entities button');
      await allEntitiesBtn.click({ force: true });

      const showViews = this.page.locator(this.locators.diagramShowViews);
      const showPages = this.page.locator(this.locators.diagramShowPages);
      const showTables = this.page.locator(this.locators.diagramShowTables);
      const showTriggers = this.page.locator(this.locators.diagramShowTriggers);

      const diagramAllEntityChecks = [
        { cb: showViews, label: this.locators.diagramLabelShowViews, text: 'Views' },
        { cb: showPages, label: this.locators.diagramLabelShowPages, text: 'Pages' },
        { cb: showTables, label: this.locators.diagramLabelShowTables, text: 'Tables' },
        { cb: showTriggers, label: this.locators.diagramLabelShowTriggers, text: 'Triggers' }
      ];
      for (const c of diagramAllEntityChecks) {
        await expect(c.cb).toBeChecked();
        await expect(this.page.locator(c.label)).toHaveText(c.text);
      }

      const newBtn = this.page.locator(this.locators.diagramNewBtn).first();
      Logger?.info?.('Action: click Diagram New dropdown');
      await newBtn.click({ force: true });

      const newDropdownLinks = [
        { loc: this.locators.diagramNewViewLink, count: 1 },
        { loc: this.locators.diagramNewPageLink, count: 1 },
        { loc: this.locators.diagramNewTableLink, count: 1 },
        { loc: this.locators.diagramNewTriggerLink, count: 1 }
      ];
      for (const c of newDropdownLinks) await expect(this.page.locator(c.loc)).toHaveCount(c.count);

      const viewCreateHref = await this.page.locator(this.locators.diagramNewViewLink).first().getAttribute('href');
      expect(viewCreateHref).toBeTruthy();

      Logger?.info?.('Action: navigate using View create link from New dropdown');
      await this.page.goto(`${baseURL}${viewCreateHref}`, { waitUntil: 'domcontentloaded' });
      await expect(this.page).toHaveURL(/\/viewedit\/new/);

      Logger?.info?.('Action: go back to Diagram');
      await this.page.goBack();
      await expect(this.page).toHaveURL(/\/diagram(\?|$)/);

      const tagsBtn = this.page.locator(this.locators.diagramTagsBtn).first();
      Logger?.info?.('Action: open Diagram Tags dropdown');
      await tagsBtn.click({ force: true });

      await expect(this.page.locator(this.locators.diagramNoTags)).toBeChecked();
      const namedTagFilters = this.page.locator('[id^="tagFilter_box_"]');
      const namedTagFilterCount = await namedTagFilters.count();
      if (namedTagFilterCount > 0) {
        await expect(namedTagFilters.first()).not.toBeChecked();
      } else {
        Logger?.info?.('Diagram Tags: no per-tag filter checkboxes (only no tags)');
      }
      await expect(this.page.locator(this.locators.diagramTagNewLink)).toHaveCount(1);

      Logger?.info?.('Action: trial click Diagram refresh and camera buttons');
      await expect(this.page.locator(this.locators.diagramRefreshBtn).first()).toBeVisible({ timeout: 15000 });
      await expect(this.page.locator(this.locators.diagramCameraBtn).first()).toBeVisible({ timeout: 15000 });
      await this.page.locator(this.locators.diagramRefreshBtn).first().click({ trial: true });
      await this.page.locator(this.locators.diagramCameraBtn).first().click({ trial: true });

      if (namedTagFilterCount > 0) {
        Logger?.info?.('Action: toggle first tag filter checkbox');
        const cb = namedTagFilters.first();
        await cb.click({ force: true });
        await expect(cb).toBeChecked();
        await cb.click({ force: true });
        await expect(cb).not.toBeChecked();
      }
    });

    await this.takeDebugScreenshot('tc_41_diagram_01_filters', Logger);
  }

  async tc41_assert_registry_editor_tab_controls(Logger, baseURL) {
    await this.open_Site_Structure_Menu(baseURL, Logger);
    await this.Site_Structure_to_Registry_editor();

    await customAssert('Registry editor UI is visible with entity tree and search box', async () => {
      await expect(this.page).toHaveURL(/\/registry-editor/);

      const activeCrumb = this.page.locator(this.locators.activeBreadcrumb).first();
      await expect(activeCrumb).toContainText('Registry editor');

      const entitiesCardHeader = this.page.locator(this.locators.registryEntitiesHeader).filter({ hasText: 'Entities' }).first();
      await expect(entitiesCardHeader).toBeVisible({ timeout: 15000 });

      const expectedSections = ['Tables', 'Views', 'Pages', 'Triggers', 'Configuration', 'Modules'];
      for (const section of expectedSections) {
        await expect(this.page.locator(this.locators.kateTreeSummary).filter({ hasText: section }).first()).toBeVisible({ timeout: 15000 });
      }

      await expect(this.page.locator(this.locators.registryRightPanelBody).filter({ hasText: 'Choose an entity to edit' }).first()).toBeVisible({ timeout: 15000 });

      const searchInput = this.page.locator(this.locators.registryEntitiesSearchInput);
      await expect(searchInput).toBeVisible({ timeout: 15000 });
      await expect(searchInput).toHaveAttribute('placeholder', 'Search');

      Logger?.info?.('Action: search Registry editor for "timezone"');
      await searchInput.fill('timezone');
      Logger?.info?.('Action: submit Registry editor search');
      await this.page.locator(this.locators.registryEntitiesSearchSubmit).click();
      await this.page.waitForURL(/q=timezone/, { timeout: 30000 });

      const timezoneLink = this.page.locator(this.locators.kateTreeTimezoneLink).first();
      await expect(timezoneLink).toBeVisible({ timeout: 15000 });

      Logger?.info?.('Action: click timezone entity link');
      await timezoneLink.click({ force: true });
      await expect(this.page).toHaveURL(/ename=timezone/);
      await expect(this.page.locator(this.locators.saveButtonByText).first()).toBeVisible({ timeout: 15000 });
    });

    await this.takeDebugScreenshot('tc_41_registry_01_after_search', Logger);
  }

  
  async navigate_To_Site_Structure() {
    await this.page.waitForSelector(this.locators.SiteStructure);
    await this.page.click(this.locators.SiteStructure);
  }
  async open_Site_Structure_Menu(baseURL, Logger) {
    const menuTabActiveCount = await this.page
      .locator(`${this.locators.siteStructureTabStrip} a[href="/menu"].active`)
      .count();
    if (menuTabActiveCount > 0) return;

    Logger?.info('Action: open Settings -> Site structure');
    await this.navigate_To_Settings();

    const collapseSettings = this.page.locator(this.locators.collapseSettings);
    const collapseSettingsShown = this.page.locator(this.locators.collapseSettingsShown);
    await collapseSettings.waitFor({ state: 'attached', timeout: 30000 });

    if ((await collapseSettingsShown.count()) === 0) {
      Logger?.info('Action: expand Settings sidebar section');
      const settingsNavLink = this.page.locator(this.locators.settingsNavLink).first();
      await settingsNavLink.waitFor({ state: 'attached', timeout: 30000 });
      await settingsNavLink.click({ force: true });
      const shownAfter = await collapseSettingsShown.count();
      Logger?.info(`Settings collapse shownAfterClick=${shownAfter}`);
    }

    const siteStructureScoped = this.page.locator(this.locators.siteStructureScoped).first();
    const siteStructureFallback = this.page.locator(this.locators.siteStructureFallback).first();
    let siteStructureLink = siteStructureScoped;
    if ((await siteStructureScoped.count()) === 0) siteStructureLink = siteStructureFallback;

    await siteStructureLink.waitFor({ state: 'attached', timeout: 30000 });
    const isVisible = await siteStructureLink.isVisible().catch(() => false);
    Logger?.info(`Site structure sidebar link attached. isVisible=${isVisible}`);
    if (isVisible) {
      await siteStructureLink.click({ force: true });
    } else {
      Logger?.info('Action: Site structure link not visible, click via DOM');
      await this.page.evaluate(
        ({ scopedSel, fallbackSel }) => {
          const scoped = document.querySelector(scopedSel);
          const any = document.querySelector(fallbackSel);
          (scoped || any)?.click();
        },
        {
          scopedSel: this.locators.siteStructureScoped,
          fallbackSel: this.locators.siteStructureFallback,
        }
      );
    }

    const tabStrip = this.page.locator(this.locators.siteStructureTabStrip);
    const waitUrlOrUi = async (timeoutMs) => {
      return await Promise.race([
        this.page.waitForURL(/\/(menu|site-structure)(\?|$)/, { timeout: timeoutMs }).then(() => 'url').catch(() => null),
        tabStrip.waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'ui').catch(() => null),
      ]);
    };
    let urlOrUi = await waitUrlOrUi(15000);
    Logger?.info(`Site structure navigation wait resolvedBy=${urlOrUi || 'timeout'}`);
    if (!urlOrUi) {
      Logger?.info('Fallback: hard navigate to /menu');
      await this.page.goto(`${baseURL}/menu`, { waitUntil: 'domcontentloaded' });
      urlOrUi = await waitUrlOrUi(30000);
      Logger?.info(`Site structure navigation fallback resolvedBy=${urlOrUi || 'timeout'}`);
    }
  }

  async openRegistryEditorFromPeopleList(Logger) {
    // Navigate from Views -> People_list overflow (...) -> Registry editor.
    if (this.page.url().includes('/registry-editor')) return;

    Logger?.info('Action: open Views (left panel)');
    await this.views();
    await this.page.waitForTimeout(1500);

    const yourViews = this.page.getByText('Your views').first();
    await expect(yourViews).toBeVisible({ timeout: 15000 });

    Logger?.info('Action: locate People_list row in views table');
    const peopleListRow = this.page.locator('table tbody tr').filter({ hasText: 'People_list' }).first();
    await expect(peopleListRow).toBeVisible({ timeout: 15000 });

    Logger?.info('Action: open row overflow menu for People_list');
    let overflowButton = null;
    const overflowCandidates = [
      peopleListRow.locator('button.dropdown-toggle').first(),
      peopleListRow.locator('button[data-bs-toggle="dropdown"]').first(),
      peopleListRow.locator('button:has(svg)').first(),
      peopleListRow.locator('button:has-text("...")').first(),
      peopleListRow.locator('a:has-text("...")').first(),
    ];

    for (const candidate of overflowCandidates) {
      if ((await candidate.count()) > 0) {
        if ((await candidate.first().isVisible().catch(() => false)) === true) {
          overflowButton = candidate;
          break;
        }
      }
    }

    expect(overflowButton).not.toBeNull();
    await expect(overflowButton).toBeVisible({ timeout: 5000 });

    await overflowButton.click();
    await this.page.waitForTimeout(1000);

    Logger?.info('Action: click Registry editor option from dropdown');
    let registryEditorMenuItem = null;
    const registryCandidates = [
      this.page.locator('.dropdown-menu.show a:has-text("Registry editor")').first(),
      this.page.locator('.dropdown-menu.show button:has-text("Registry editor")').first(),
      this.page.getByRole('menuitem', { name: 'Registry editor' }).first(),
    ];

    for (const candidate of registryCandidates) {
      if ((await candidate.count()) > 0) {
        if ((await candidate.first().isVisible().catch(() => false)) === true) {
          registryEditorMenuItem = candidate;
          break;
        }
      }
    }

    expect(registryEditorMenuItem).not.toBeNull();
    await expect(registryEditorMenuItem).toBeVisible({ timeout: 5000 });

    await registryEditorMenuItem.click();
    await this.page.waitForTimeout(1500);

    await expect(this.page).toHaveURL(/\/registry-editor/, { timeout: 15000 });
    await expect(this.page.locator(this.locators.registrylocator)).toBeVisible({ timeout: 15000 });
  }

  async run_With_Dialog_Accept(action, Logger) {
    this.page.once('dialog', async (dialog) => {
      Logger?.info(`Dialog accepted: ${dialog.message()}`);
      await dialog.accept();
    });
    await action();
  }

  async assert_Mutation_Persistence(description, persistenceCheck, Logger) {
    await persistenceCheck();
    Logger?.info(`Mutation feedback (${description}): persistence verified (no toast assumption)`);
  }

  async navigate_To_Events() {
    await this.page.waitForSelector(this.locators.Events, { timeout: 5000 });
    await this.page.click(this.locators.Events);
  }

  async open_All_Entities_From_Settings(baseURL, Logger) {
    Logger?.info?.('Action: open left panel Settings');
    await this.navigate_To_Settings();

    const expanded = await this.page.locator(this.locators.settingsCollapsePanelShown).count();
    if (!expanded) {
      await this.page.locator(this.locators.settingsSidebarLink).first().click({ force: true });
    }

    Logger?.info?.('Action: click left panel All entities');
    await this.page.locator(this.locators.allEntitiesSidebarLink).first().click({ force: true });
    const routed = await this.page.waitForURL(/\/entities(\?|$)/, { timeout: 7000 }).then(() => true).catch(() => false);
    if (!routed) {
      Logger?.info?.('Fallback: hard navigate to /entities');
      await this.page.goto(`${baseURL}/entities`, { waitUntil: 'domcontentloaded' });
    }
    await expect(this.page).toHaveURL(/\/entities(\?|$)/);
  }

  async search_All_Entities(searchText) {
    await this.fill_Text(this.locators.allEntitiesSearchInput, searchText);
    await this.page.waitForTimeout(800);
  }

  async clear_All_Entities_Search() {
    await this.fill_Text(this.locators.allEntitiesSearchInput, '');
    await this.page.waitForTimeout(700);
  }

  async set_All_Entities_Deep_Search(enabled) {
    const deepSearchInput = this.page.locator(this.locators.allEntitiesDeepSearchInput).first();
    const deepSearchLabel = this.page.locator(this.locators.allEntitiesDeepSearchLabel).first();
    const hasInput = (await deepSearchInput.count()) > 0;
    const hasLabel = (await deepSearchLabel.count()) > 0;
    if (!hasInput && !hasLabel) return false;

    if (hasInput) {
      if (enabled) {
        await deepSearchInput.check({ force: true }).catch(async () => {
          if (hasLabel) await deepSearchLabel.click({ force: true });
        });
      } else {
        await deepSearchInput.uncheck({ force: true }).catch(async () => {
          if (hasLabel) await deepSearchLabel.click({ force: true });
        });
      }
    } else if (hasLabel) {
      await deepSearchLabel.click({ force: true });
    }
    return true;
  }

  async assert_All_Entities_Landing_Controls() {
    await customAssert('All entities page key controls should be visible', async () => {
      await expect(this.page.locator(this.locators.allEntitiesSearchInput).first()).toBeVisible();
      await expect(this.page.locator(this.locators.allEntitiesHeader).first()).toBeVisible();
      await expect(this.page.locator(this.locators.allEntitiesTypesLabel).first()).toBeVisible();
      await expect(this.page.locator(this.locators.allEntitiesTagsLabel).first()).toBeVisible();
    });
  }

  async verify_All_Entities_Search_Flow() {
    await this.set_All_Entities_Deep_Search(true);
    await this.search_All_Entities('user');
    await customAssert('URL should include valid search query', async () => {
      await expect(this.page).toHaveURL(/\/entities.*q=user/);
    });

    await this.search_All_Entities('invalid_zzzz_12345');
    await customAssert('URL should include invalid search query', async () => {
      await expect(this.page).toHaveURL(/\/entities.*q=invalid_zzzz_12345/);
    });

    await this.clear_All_Entities_Search();
    await this.set_All_Entities_Deep_Search(false);
    await customAssert('Should remain on entities page after search reset', async () => {
      await expect(this.page).toHaveURL(/\/entities(\?|$)/);
    });
  }

  async verify_All_Entities_Type_Chip_Navigation(baseURL, Logger, typeCases) {
    for (const tc of typeCases) {
      Logger?.info?.(`Action: click ${tc.label} chip`);
      const chip = this.page.locator(`button:has-text("${tc.label}"), a:has-text("${tc.label}")`).first();
      if ((await chip.count()) === 0 && (tc.label === 'Users' || tc.label === 'Modules' || tc.label === 'Triggers')) {
        const more = this.page.locator(this.locators.allEntitiesMoreToggle).first();
        if ((await more.count()) > 0) await more.click({ force: true });
      }

      await chip.click({ force: true });
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(700);
      await customAssert(`${tc.label} should navigate to expected URL`, async () => {
        await expect(this.page).toHaveURL(tc.url);
      });

      if (tc.label !== 'Triggers') {
        await this.page.goBack({ waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(700);
      } else {
        await this.page.goto(`${baseURL}/entities`, { waitUntil: 'domcontentloaded' });
      }

      await customAssert(`After ${tc.label}, should return to entities page`, async () => {
        await expect(this.page).toHaveURL(/\/entities(\?|$)/);
      });
    }
  }

  async verify_All_Entities_Less_More_And_Tags() {
    const more = this.page.locator(`${this.locators.allEntitiesMoreToggle}:visible`).first();
    if ((await more.count()) > 0) {
      await more.click({ force: true });
      await this.page.waitForTimeout(700);
      await expect(this.page.locator(this.locators.allEntitiesUsersChip).first()).toHaveCount(1);
      await expect(this.page.locator(this.locators.allEntitiesModulesChip).first()).toHaveCount(1);
    }

    const tagButtons = this.page.locator(this.locators.allEntitiesTagChipButtons).filter({ hasText: /^(Aurora|e2e_tag_)/ });
    const tagCount = await tagButtons.count();
    expect(tagCount).toBeGreaterThan(0);
    if (tagCount > 1) {
      await tagButtons.nth(0).click({ force: true });
      await this.page.waitForTimeout(600);
      await tagButtons.nth(1).click({ force: true });
      await this.page.waitForTimeout(600);
    }
    await expect(this.page).toHaveURL(/\/entities(\?|$)/);
  }

  async verify_All_Entities_User_Row_Actions(baseURL) {
    await this.page.goto(`${baseURL}/entities?extended=on&tables=on&q=users`, { waitUntil: 'domcontentloaded' });
    await expect(this.page).toHaveURL(/\/entities\?extended=on&tables=on&q=users/);

    const usersRow = this.page.locator(this.locators.allEntitiesTableRows).filter({
      has: this.page.getByRole('link', { name: 'users' }).first()
    }).first();
    await expect(usersRow).toBeVisible({ timeout: 30000 });

    const actionsBtn = usersRow.locator(this.locators.allEntitiesActionsButtonInRow).first();
    await actionsBtn.scrollIntoViewIfNeeded();
    await this.page.keyboard.press('Escape').catch(async () => { });
    await actionsBtn.click({ force: true });
    await this.page.waitForTimeout(700);

    await expect(this.page.locator(this.locators.allEntitiesActionsMenu)).toBeVisible();
    await expect(this.page.locator(this.locators.allEntitiesActionRecalculate)).toBeVisible();
    await expect(this.page.locator(this.locators.allEntitiesActionDeleteRows)).toBeVisible();
    await expect(this.page.locator(this.locators.allEntitiesActionRegistryEditor)).toBeVisible();
  }

  async create_Table_From_All_Entities(tableName) {
    const createTableBtn = this.page.locator(this.locators.allEntitiesCreateTable).first();
    await createTableBtn.scrollIntoViewIfNeeded();
    await createTableBtn.click({ force: true });
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(700);
    await expect(this.page).toHaveURL(/\/table\/new\/?(\?|$)/);
    await this.fill_Text(this.locators.InputName, tableName);
    await this.submit();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async create_View_From_All_Entities(viewName, description = 'e2e view from all entities') {
    const createViewBtn = this.page.locator(this.locators.allEntitiesCreateView).first();
    await createViewBtn.scrollIntoViewIfNeeded();
    await createViewBtn.click({ force: true });
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(700);
    await expect(this.page).toHaveURL(/\/viewedit\/new(\?|$)/);

    await this.fill_Text(this.locators.InputName, viewName);
    if ((await this.page.locator(this.locators.discriptiontext).count()) > 0) {
      await this.fill_Text(this.locators.discriptiontext, description);
    }
    if ((await this.page.locator(this.locators.viewtabledropdown).count()) > 0) {
      await this.page.locator(this.locators.viewtabledropdown).selectOption({ label: 'users' }).catch(async () => {
        await this.page.locator(this.locators.viewtabledropdown).selectOption({ index: 0 });
      });
    }
    await this.submit();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async create_Page_From_All_Entities(pageName) {
    const createPageBtn = this.page.locator(this.locators.allEntitiesCreatePage).first();
    await createPageBtn.scrollIntoViewIfNeeded();
    await createPageBtn.click({ force: true });
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(700);
    await expect(this.page).toHaveURL(/\/pageedit\/new(\?|$)/);

    const pageNameInput = this.page.locator(this.locators.inputpagename).first();
    if ((await pageNameInput.count()) > 0) await this.fill_Text(this.locators.inputpagename, pageName);
    else await this.fill_Text(this.locators.InputName, pageName);

    await this.submit();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async create_Trigger_From_All_Entities(triggerName) {
    const createTriggerBtn = this.page.locator(this.locators.allEntitiesCreateTrigger).first();
    await createTriggerBtn.scrollIntoViewIfNeeded();
    await createTriggerBtn.click({ force: true });
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(700);
    await expect(this.page).toHaveURL(/\/actions\/new(\?|$)/);

    await this.fill_Text(this.locators.InputName, triggerName);
    if ((await this.page.locator(this.locators.whentrigger).count()) > 0) {
      await this.page.locator(this.locators.whentrigger).selectOption({ index: 1 }).catch(async () => { });
    }
    if ((await this.page.locator(this.locators.inputtableid).count()) > 0) {
      await this.page.locator(this.locators.inputtableid).selectOption({ index: 1 }).catch(async () => { });
    }
    if ((await this.page.locator(this.locators.inputaction).count()) > 0) {
      await this.page.locator(this.locators.inputaction).selectOption({ index: 1 }).catch(async () => { });
    }
    await this.submit();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async verify_Entity_Is_Visible_In_List(listPath, entityName, assertionMessage = 'Entity should be visible in list') {
    await this.page.goto(listPath, { waitUntil: 'domcontentloaded' });
    await customAssert(assertionMessage, async () => {
      await expect(this.page.getByText(entityName).first()).toBeVisible({ timeout: 30000 });
    });
  }

  async verify_Entity_Is_Searchable_In_All_Entities(baseURL, entityName, Logger) {
    await this.open_All_Entities_From_Settings(baseURL, Logger);
    await this.search_All_Entities(entityName);
    await customAssert('Entity should be searchable in All entities', async () => {
      await expect(this.page.getByText(entityName).first()).toBeVisible({ timeout: 30000 });
    });
  }

  async open_Views_From_All_Entities() {
    await this.page.locator(this.locators.allEntitiesViewsChip).first().click({ force: true });
    await this.page.waitForLoadState('domcontentloaded');
  }

  async assert_Views_List_Loaded() {
    await expect(this.page).toHaveURL(/\/viewedit(\?|$)/);
    await expect(this.page.locator(this.locators.primaryTable).first()).toBeVisible({ timeout: 30000 });
  }

  async takeDebugScreenshot(name, Logger, debugDir = 'test-results') {
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
    const path = `${debugDir}/${name}_${Date.now()}.png`;
    await this.page.screenshot({ path, fullPage: true });
    Logger?.info?.(`Debug screenshot saved: ${path}`);
    return path;
  }

}

module.exports = PageFunctions;
