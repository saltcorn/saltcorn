const { expect } = require('@playwright/test');
class PageFunctions {
  constructor(page) {
    this.page = page;
    this.locators = new (require('./locators'))(page);
  }

  async navigate_To_Base_URL(baseURL, derivedURL) {
    await this.page.goto(baseURL + derivedURL);
  }

  async submit() {
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
    await this.page.fill(this.locators.newPageNameInput, pageName);
    await this.page.click(this.locators.submitButton);
  }

  async drag_And_Drop(source, target) {
    await this.page.locator(source).dragTo(this.page.locator(target), { force: true });
  }

  async fill_Text(selector, text) {
    await this.page.fill(selector, text);
  }

  async navigate_To_Settings() {
    await this.page.click(this.locators.settingsTab);
  }

  async navigate_To_about_application() {
    await this.page.waitForSelector(this.locators.aboutApplicationLink);
    await this.page.click(this.locators.aboutApplicationLink, { force: true });
  }
  async about_application_to_system() {
    await this.page.click(this.locators.systemSettingsLink);

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
  async validate_Each_Tab_Of_Module() {
    const selectors = [
      '#page-inner-content > div:nth-child(2) > div.card.shadow.mt-0 > div > div > ul > li:nth-child(1) > a',
      '#page-inner-content > div:nth-child(2) > div.card.shadow.mt-0 > div > div > ul > li:nth-child(2)',
      '#page-inner-content > div:nth-child(2) > div.card.shadow.mt-0 > div > div > ul > li:nth-child(3)',
      '#page-inner-content > div:nth-child(2) > div.card.shadow.mt-0 > div > div > ul > li:nth-child(4)',
      '#page-inner-content > div:nth-child(2) > div.card.shadow.mt-0 > div > div > ul > li:nth-child(5)'
    ];
  
    for (const selector of selectors) {
      const element = this.page.locator(selector);
      await expect(element).toBeVisible();
      await element.click();
  }}

  async Validate_each_tab_of_Users_And_Security() {
    const tabs = [
      'Users',
      'Roles',
      'Login and Signup',
      'Table access',
      'HTTP',
      'Permissions'
    ];

    // Check if each tab is visible and has the correct text
    for (const tab of tabs) {
      const tabLocator = this.page.locator(`ul.nav.nav-pills.plugin-section a.nav-link:has-text("${tab}")`);
      await expect(tabLocator).toBeVisible();
      await expect(tabLocator).toHaveText(tab);
      await (tabLocator).click();
    }
  }

  async Validate_each_tab_of_Site_Structure() {
    const tabs = [
      'Menu',
      'Search',
      'Library',
      'Languages',
      'Pagegroups',
      'Tags',
      'Diagram',
      'Registry editor'
    ];

    // Check if each tab is visible and has the correct text
    for (const tab of tabs) {
      const tabLocator = this.page.locator(`ul.nav.nav-pills.plugin-section a.nav-link:has-text("${tab}")`);
      await expect(tabLocator).toBeVisible();
      await expect(tabLocator).toHaveText(tab);
      await (tabLocator).click();
    }
  }

  async Validate_each_tab_of_Files() {
    const tabs = [
      'Files',
      'Storage',
      'Settings'
    ];

    // Check if each tab is visible and has the correct text
    for (const tab of tabs) {
      const tabLocator = this.page.locator(`ul.nav.nav-pills.plugin-section a.nav-link:has-text("${tab}")`);
      await expect(tabLocator).toBeVisible();
      await expect(tabLocator).toHaveText(tab);
      await (tabLocator).click();
    }
  }

  async Validate_each_tab_of_Events() {
    const tabs = [
      'Triggers',
      'Custom',
      'Log settings',
      'Event log'
    ];

    // Check if each tab is visible and has the correct text
    for (const tab of tabs) {
      const tabLocator = this.page.locator(`ul.nav.nav-pills.plugin-section a.nav-link:has-text("${tab}")`);
      await expect(tabLocator).toBeVisible();
      await expect(tabLocator).toHaveText(tab);
      await (tabLocator).click();
    }
  }

  async navigate_To_module() {
    await this.page.waitForSelector(this.locators.Modulesettngsidebar);
    await this.page.click(this.locators.Modulesettngsidebar);
  }

  async navigate_To_Users_And_Security() {
    await this.page.waitForSelector(this.locators.UsersAndSecurity);
    await this.page.click(this.locators.UsersAndSecurity);
  }

  async navigate_To_Site_Structure() {
    await this.page.waitForSelector(this.locators.SiteStructure);
    await this.page.click(this.locators.SiteStructure);
  }

  async navigate_To_Events() {
    await this.page.waitForSelector(this.locators.Events);
    await this.page.click(this.locators.Events);
  }

  async navigate_To_File() {
    await this.page.waitForSelector(this.locators.File);
    await this.page.click(this.locators.File);
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
    await this.page.click(this.locators.saveButton);
  }

  async click_table() {
    await this.page.click(this.locators.click_table)
  }

  async SALTCORN() {
    await this.page.click(this.locators.SaltCornButton)
  }

  async views() {
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

  // async clickAllDropdownItems(page,settingdropdown) {
  //   await this.page.click(this.locators.settingsTab);
  //   // Get all the dropdown items
  //   const dropdownItems = await page.$$(this.locators.settingdropdown + 'a.collapse-item');

  //   // Loop through each dropdown item and click it
  //   for (const item of dropdownItems) {
  //     await item.click();
  //     // Optionally, you can add some assertion or wait time here if needed
  //   }
  // }


}

module.exports = PageFunctions;
