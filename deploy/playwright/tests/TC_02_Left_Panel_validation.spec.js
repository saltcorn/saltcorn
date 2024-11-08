const { test, expect } = require('@playwright/test');
const { baseURL, derivedURL } = require('../pageobject/base_url.js');
const PageFunctions = require('../pageobject/function.js');
const PageObject = require('../pageobject/locators.js');
const customAssert = require('../pageobject/utils.js');
const Logger = require('../pageobject/logger.js');
//const { TIMEOUT } = require('dns');

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

  test('Click table button and verify URL', async () => {
    //click table button
    await functions.click_table();
    // assert the table url
    await customAssert('page url should be /table', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'table');
    });
  });
  
  // Assert the presence of "Your tables" tab
  test('Validate presence of "Your tables" tab', async () => {
    //click table button
    await functions.click_table();
    // assert the visiblity of table tab
    await customAssert('your table tab should be visible', async () => {
    await expect(page.locator(pageobject.Yourtabletab)).toBeVisible();
    // Assert the text of the table tab
    await expect(page.locator(pageobject.Yourtabletab)).toHaveText('Your tables');
    });
  });

  // Assert the table contains "users" row by defalut
  test('Verify default "users" row in the table', async () => {
    //click table button
    await functions.click_table();
    //assert the default user table
    await customAssert('User table should be visible', async () => {
    await expect(page.locator(pageobject.Defaultusertable)).toBeVisible();
    await expect(page.locator(pageobject.Defaultusertable)).toHaveText('users');
    });
  });

  // Assert the presence of "Create table" button
  test('Check visibility of "Create table" button', async () => {
    await expect(page.locator(pageobject.createtablebutton)).toBeVisible();
    await expect(page.locator(pageobject.createtablebutton)).toHaveText('Create table');
  });

  // Assert the presence of "Create from CSV upload" button
  test('Check visibility of "Create from CSV upload" button', async () => {
    //click table button
    await functions.click_table();
    //asert the create table from csv option
    await customAssert('Create table from csv button should be visible', async () => {
    await expect(page.locator(pageobject.createtablefromCSV)).toBeVisible();
    await expect(page.locator(pageobject.createtablefromCSV)).toHaveText('Create from CSV upload');
    });
  });

  // Assert the presence of "Discover tables" button
  test('Check visibility of "Discover tables" button', async () => {
    //click table button
    await functions.click_table();
    // assert the discover button
    await customAssert('discover button should be visible', async () => {
    await expect(page.locator(pageobject.discoverbutton)).toBeVisible();
    await expect(page.locator(pageobject.discoverbutton)).toHaveText('Discover tables');
    });
  });

  // Assert the presence of "Relationship diagram" tab
  test('Validate presence of "Relationship diagram" tab', async () => {
    //click table button
    await functions.click_table();
    // assert the visibility of relationship diagram
    await customAssert('relationship diagram tab should be visible', async () => {
    await expect(page.locator(pageobject.relationshipdiagram)).toBeVisible();
    await expect(page.locator(pageobject.relationshipdiagram)).toHaveText('Relationship diagram');
    });
  });

  // Assert the presence of "Create new views" button
  test('Verify "Views" section and "Create new view" button', async () => {
    await functions.views();
    // assert the view edit url
    await customAssert('page url should be /viewtable', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'viewedit');
    });
    //assert the visibility of create new view
    await customAssert('create new view button should be visible', async () => {
    await expect(page.locator(pageobject.createnewview)).toBeVisible();
    await expect(page.locator(pageobject.createnewview)).toHaveText('Create view');
    });
    //click on create new view
    await page.click(pageobject.createnewview);
    // assert the view url
    await customAssert('page url should be /viewedit/new', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'viewedit/new');
    });
  });

  // Assert the presence of "About Application" button
  test('Validate "About Application" tabs', async () => {
    functions = new PageFunctions(page);
    // Navigate to setting
    await functions.navigate_To_Settings();
    // Navigate to about applications
    await page.click(pageobject.aboutApplicationLink);
    await customAssert('Assert the lable of About application setting', async () => {
    await expect(page.locator(pageobject.aboutApplicationLink)).toHaveText('About application');
    });
    // assert the about application url
    await customAssert('page url should be /admin', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'admin', { TIMEOUT:20000 });
    });
    // validate each tab of about application and assert url
    await functions.about_application_to_site_identity();
    await customAssert('Assert the lable of Site identity tab', async () => {
    await expect(page.locator(pageobject.siteidentitylocator)).toHaveText('Site identity');
    });
    await customAssert('page url should be /admin', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'admin');
    });
    await functions.about_application_to_backup();
    await customAssert('Assert the lable of Backup tab', async () => {
    await expect(page.locator(pageobject.backuplocator)).toHaveText('Backup');
    });
    await customAssert('page url should be /admin/backup', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'admin' + derivedURL + 'backup');
    });
    await functions.about_application_to_email();
    await customAssert('Assert the lable of Email tab', async () => {
    await expect(page.locator(pageobject.emaillocator)).toHaveText('Email');
    });
    await customAssert('page url should be /admin/email', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'admin' + derivedURL + 'email');
    });
    await functions.about_application_to_system();
    await customAssert('Assert the lable of System tab', async () => {
    await expect(page.locator(pageobject.systemSettingsLink)).toHaveText('System');
    });
    await customAssert('page url should be /admin/system', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'admin' + derivedURL + 'system');
    });
    await functions.about_application_to_mobile_app();
    await customAssert('Assert the lable of Mobile app tab', async () => {
    await expect(page.locator(pageobject.mobileapplocator)).toHaveText('Mobile app');
    });
    await customAssert('page url should be /admin/build-mobile-app', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'admin' + derivedURL + 'build-mobile-app');
    });
    await functions.about_application_to_development();
    await customAssert('Assert the lable of development tab', async () => {
    await expect(page.locator(pageobject.developmentlocator)).toHaveText('Development');
    });
    await customAssert('page url should be /admin/dev', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'admin' + derivedURL + 'dev');
    });
    await functions.about_application_to_notification();
    await customAssert('Assert the lable of notifications tab', async () => {
    await expect(page.locator(pageobject.notificationlocator)).toHaveText('Notifications');
    });
    await customAssert('page url should be /admin/notifications', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'admin' + derivedURL + 'notifications');
    });
  });
  
  test('Validate "Module" tabs', async () => {
    functions = new PageFunctions(page);
    await functions.SALTCORN();
    // Navigate to setting
    await functions.navigate_To_Settings();
    // Navigate to Module
    await functions.navigate_To_module();
    await customAssert('Assert the lable of Modules setting', async () => {
    await expect(page.locator(pageobject.Modulesettingsidebar)).toHaveText('Modules');
    });
    // Assert the module URL
    await customAssert('page url should be /plugins', async () => {
      expect(page.url()).toBe(baseURL + derivedURL + 'plugins');
    });
    // Validate each tab of module and assert URL
    await functions.navigate_To_All_modules();
    await customAssert('Assert the lable of All tab', async () => {
    await expect(page.locator(pageobject.AllModuleslocator)).toHaveText('All');
    });
    await customAssert('page url should be /plugins?set=all', async () => {
      expect(page.url()).toBe(baseURL + derivedURL + 'plugins?set=all');
    });
    await functions.navigate_modules_To_modules();
    await customAssert('Assert the lable of modules tab', async () => {
    await expect(page.locator(pageobject.Moduleslocator)).toHaveText('Modules');
    });
    await customAssert('page url should be /plugins?set=modules', async () => {
      expect(page.url()).toBe(baseURL + derivedURL + 'plugins?set=modules');
    });
    await functions.navigate_modules_To_packs();
    await customAssert('Assert the lable of Packs tab', async () => {
    await expect(page.locator(pageobject.packslocator)).toHaveText('Packs');
    });
    await customAssert('page url should be /plugins?set=packs', async () => {
      expect(page.url()).toBe(baseURL + derivedURL + 'plugins?set=packs');
    });
    await functions.navigate_modules_To_themes();
    await customAssert('Assert the lable of Themes tab', async () => {
    await expect(page.locator(pageobject.themeslocator)).toHaveText('Themes');
    });
    await customAssert('page url should be /plugins?set=themes', async () => {
      expect(page.url()).toBe(baseURL + derivedURL + 'plugins?set=themes');
    });
    await functions.navigate_modules_To_Installed();
    await customAssert('Assert the lable of Installed tab', async () => {
    await expect(page.locator(pageobject.Installedlocator)).toHaveText('Installed');
    });
    await customAssert('page url should be /plugins?set=installed', async () => {
      expect(page.url()).toBe(baseURL + derivedURL + 'plugins?set=installed');
    });
  });

  // Assert the presence of "Users and Security" tab
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

  // Assert the presence of "Site Structure" tab
  test('Validate "Site Structure" tabs', async () => {
    functions = new PageFunctions(page);
    await functions.SALTCORN();
    // Navigate to setting
    await functions.navigate_To_Settings();
    // Navigate to Site Structure
    await functions.navigate_To_Site_Structure();
    await customAssert('Assert the lable of Site Structure setting', async () => {
    await expect(page.locator(pageobject.SiteStructure)).toHaveText('Site structure');
    });
    // assert the site structure url
    await customAssert('page url should be /menu', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'menu');
    });
    // validate each tab of  site structure and assert urls
    await functions.Site_Structure_to_Menu();
    await customAssert('Assert the lable of Menu tab', async () => {
    await expect(page.locator(pageobject.menulocator)).toHaveText('Menu');
    });
    await customAssert('page url should be /menu', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'menu');
    });
    await functions.Site_Structure_to_Search();
    await customAssert('Assert the lable of Search tab', async () => {
    await expect(page.locator(pageobject.searchtablocator)).toHaveText('Search');
    });
    await customAssert('page url should be /search/config', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'search' + derivedURL + 'config');
    });
    await functions.Site_Structure_to_Library();
    await customAssert('Assert the lable of Library tab', async () => {
    await expect(page.locator(pageobject.librarylocator)).toHaveText('Library');
    });
    await customAssert('page url should be /list', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'library' + derivedURL + 'list');
    });
    await functions.Site_Structure_to_Languages();
    await customAssert('Assert the lable of Languages tab', async () => {
    await expect(page.locator(pageobject.languagelocator)).toHaveText('Languages');
    });
    await customAssert('page url should be /site-structure/localizer', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'site-structure' + derivedURL + 'localizer');
    });
    await functions.Site_Structure_to_Page_groups();
    await customAssert('Assert the lable of Pagegroups', async () => {
    await expect(page.locator(pageobject.pagegroupslocator)).toHaveText('Pagegroups');
    });
    await customAssert('page url should be /page_group/settings', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'page_group' + derivedURL + 'settings');
    });
    await functions.Site_Structure_to_Tags();
    await customAssert('Assert the lable of Tags tab', async () => {
    await expect(page.locator(pageobject.tagslocator)).toHaveText('Tags');
    });
    await customAssert('page url should be /tag', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'tag');
    });
    await functions.Site_Structure_to_Diagram();
    await customAssert('Assert the lable of Diagram tab', async () => {
    await expect(page.locator(pageobject.diagramlocator)).toHaveText('Diagram');
    });
    await customAssert('page url should be /diagram', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'diagram');
    });
    await functions.Site_Structure_to_Registry_editor();
    await customAssert('Assert the lable of Registry editor tab', async () => {
    await expect(page.locator(pageobject.registrylocator)).toHaveText('Registry editor');
    });
    await customAssert('page url should be /registry-editor', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'registry-editor');
    });
  });

  // Assert the presence of "Files" tab
  test('Validate "Files" tabs', async () => {
    functions = new PageFunctions(page);
    await functions.SALTCORN();
    // Navigate to setting
    await functions.navigate_To_Settings();
    // Navigate to Files
    await functions.navigate_To_File();
    await customAssert('Assert the lable of Files setting', async () => {
    await expect(page.locator(pageobject.File)).toHaveText('Files');
    });
    await page.waitForTimeout(2000);
    // assert the files url
    await customAssert('page url should be /files?sortBy=filename', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'files?sortBy=filename');
    });
    // validate each tab of files and assert urls
    await functions.Files_to_Files();
    await customAssert('Assert the lable of Files tab', async () => {
    await expect(page.locator(pageobject.fileslocator)).toHaveText('Files');
    });
    await page.waitForTimeout(2000);
    await customAssert('page url should be /files?sortBy=filename', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'files?sortBy=filename');
    });
    await functions.Files_to_Storage();
    await customAssert('Assert the lable of Storage tab', async () => {
    await expect(page.locator(pageobject.storagelocator)).toHaveText('Storage');
    });
    await customAssert('page url should be /files/storage', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'files' + derivedURL +'storage');
    });
    await functions.Files_to_Settings();
    await customAssert('Assert the lable of Stettings tab', async () => {
    await expect(page.locator(pageobject.Filesettinglocator)).toHaveText('Settings');
    });
    await customAssert('page url should be /files/settings', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'files' + derivedURL +'settings');
    });
  });

  // Assert the presence of "Events" tab
  test('Validate "Events" tabs', async ({browser}) => {
    functions = new PageFunctions(page);
    await functions.SALTCORN();
    // Navigate to setting
    await functions.navigate_To_Settings();
    // Navigate to Events
    await functions.navigate_To_Events();
    await customAssert('Assert the lable of Events setting', async () => {
    await expect(page.locator(pageobject.Events)).toHaveText('Events');
    });
     // assert the events url
     await customAssert('page url should be /actions', async () => {
     expect(page.url()).toBe(baseURL + derivedURL + 'actions');
     });
    // validate each tab of events and assert urls
    await functions.Events_to_Triggers();
    await customAssert('Assert the lable of Triggers tab', async () => {
    await expect(page.locator(pageobject.trigerslocator)).toHaveText('Triggers');
    });
    await customAssert('page url should be /actions', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'actions');
    });
    await functions.Events_to_Custom();
    await customAssert('Assert the lable of Custom tab', async () => {
    await expect(page.locator(pageobject.Customlocator)).toHaveText('Custom');
    });
    await customAssert('page url should be /eventlog/custom', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'eventlog' + derivedURL +'custom');
    });
    await functions.Events_to_Log_settings();
    await customAssert('Assert the lable of event log settings tab', async () => {
    await expect(page.locator(pageobject.logsettinglocator)).toHaveText('Settings');
    });
    await customAssert('page url should be /eventlog/settings', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'eventlog' + derivedURL +'settings');
    });
    await functions.Events_to_Event_log();
    await customAssert('Assert the lable of Event log tab', async () => {
    await expect(page.locator(pageobject.Eventloglocator)).toHaveText('Event log');
    });
    await customAssert('page url should be /eventlog', async () => {
    expect(page.url()).toBe(baseURL + derivedURL + 'eventlog');
    });
  });

  // Assert the presence of "User" tab
  test('Validate "User" tabs', async ({ browser }) => {
    functions = new PageFunctions(page);
    await functions.SALTCORN();
    await page.click(pageobject.userNavLink);
    await customAssert('Assert the lable of User menu', async () => {
      await expect(page.locator(pageobject.userNavLink)).toHaveText('User');
    });
    await page.click(pageobject.userSettingsLink);
    await customAssert('Assert the lable of User Setting', async () => {
      await expect(page.locator(pageobject.userSettingsLink)).toHaveText('User Settings');
    });
    await customAssert('page url should be /eventlog', async () => {
      expect(page.url()).toBe(baseURL + derivedURL + 'auth/settings');
    });
    await customAssert('Assert the lable of Logout option', async () => {
      await expect(page.locator(pageobject.logout)).toHaveText('Logout');
      await page.click(pageobject.logout);
    });
  });
});
