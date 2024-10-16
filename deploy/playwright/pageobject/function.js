const { expect } = require('@playwright/test');
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
    await this.page.locator(source).dragTo(this.page.locator(target), { force: true });
  }

  async fill_Text(selector, text) {
    await this.page.fill(selector, text, { timeout: 30000 });
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
    await this.page.waitForTimeout(5000);
    await this.page.screenshot({ path: 'screenshot-before-wait.png' });
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
    await this.page.waitForSelector(this.locators.trigerslocator);
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
    await this.page.waitForTimeout(5000);
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
    await this.page.waitForTimeout(5000);
    await this.page.waitForSelector(this.locators.File, { timeout: 25000 });
    await this.page.click(this.locators.File, { force: true });
  }

  async navigate_To_Site_Structure() {
    await this.page.waitForSelector(this.locators.SiteStructure);
    await this.page.click(this.locators.SiteStructure);
  }

  async clear_All() {
    await this.page.click(this.locators.clearAllButton);
    await this.page.waitForTimeout(2500); // Wait for navigation to complete
    await this.page.click('#inputusers');
    await this.page.waitForSelector(this.locators.submitButton);
    await this.page.click(this.locators.submitButton);
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

  async SALTCORN() {
    await this.page.waitForSelector(this.locators.SaltCornButton);
    await this.page.click(this.locators.SaltCornButton)
  }

  async views() {
    await this.page.waitForSelector(this.locators.sidebarviewbutton);
    await this.page.click(this.locators.sidebarviewbutton)
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
    await this.page.click(this.locators.aboutApplicationLink);
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
    // Wait for a few seconds
    await this.page.waitForTimeout(2000);    
    // Click the Install button
    await this.page.click(this.locators.installflatpickr);
    // Assert the success message is visible
    await customAssert('Success message should be visible', async () => {
      await this.page.waitForSelector(this.locators.successmessage);
      await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
    });
    await this.navigate_modules_To_Installed();
    await customAssert('flatpickr-date module should be present in installed tab', async () => {
      await expect(this.page.locator(this.locators.flatpickrDateHeader)).toBeVisible();
    });
  }

  async install_ckeditor() {
    await this.navigate_To_Settings();
    // Navigate to Module
    await this.navigate_To_module();
    // Search with 'flatpickr' in the search bar
    await this.fill_Text(this.locators.SearchModule, 'ckeditor');
    // Assert that the flatpickr module is visible and click on it
    await customAssert('ckeditor4 module should be visible', async () => {
      await expect(this.page.locator(this.locators.ckeditorHeader)).toBeVisible();
      await this.page.click('button#button-search-submit');
    });
    // Wait for a few seconds
    await this.page.waitForTimeout(2000);    
    // Click the Install button
    await this.page.click(this.locators.installCkeditor4);
    // Assert the success message is visible
    await customAssert('Success message should be visible', async () => {
      await this.page.waitForSelector(this.locators.successmessage);
      await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
    });
    await this.navigate_modules_To_Installed();
    await customAssert('ckeditor4 module should be present in installed tab', async () => {
      await expect(this.page.locator(this.locators.ckeditorHeader)).toBeVisible();
    });
  }

  async install_kanban() {
    await this.navigate_To_Settings();
    // Navigate to Module
    await this.navigate_To_module();
    // Search with 'flatpickr' in the search bar
    await this.fill_Text(this.locators.SearchModule, 'kanban');
    // Assert that the flatpickr module is visible and click on it
    await customAssert('kanban module should be visible', async () => {
      await expect(this.page.locator(this.locators.kanbanHeader)).toBeVisible();
      await this.page.click('button#button-search-submit');
    });
    // Wait for a few seconds
    await this.page.waitForTimeout(2000);    
    // Click the Install button
    await this.page.click(this.locators.installkanban);
    // Assert the success message is visible
    await customAssert('Success message should be visible', async () => {
      await this.page.waitForSelector(this.locators.successmessage);
      await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
    });
    await this.navigate_modules_To_Installed();
    await customAssert('kanban module should be present in installed tab', async () => {
      await expect(this.page.locator(this.locators.kanbanHeader)).toBeVisible();
    });
  }

  async install_badges() {
    await this.navigate_To_Settings();
    // Navigate to Module
    await this.navigate_To_module();
    // Search with 'flatpickr' in the search bar
    await this.fill_Text(this.locators.SearchModule, 'badges');
    // Assert that the flatpickr module is visible and click on it
    await customAssert('badges module should be visible', async () => {
      await expect(this.page.locator(this.locators.badgesHeader)).toBeVisible();
      await this.page.click('button#button-search-submit');
    });
    // Wait for a few seconds
    await this.page.waitForTimeout(2000);    
    // Click the Install button
    await this.page.click(this.locators.installbadges);
    // Assert the success message is visible
    await customAssert('Success message should be visible', async () => {
      await this.page.waitForSelector(this.locators.successmessage);
      await expect(this.page.locator(this.locators.successmessage)).toHaveText('success');
    });
    await this.navigate_modules_To_Installed();
    await customAssert('badges module should be present in installed tab', async () => {
      await expect(this.page.locator(this.locators.badgesHeader)).toBeVisible();
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

}

module.exports = PageFunctions;
