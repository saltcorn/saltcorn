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

    // Assert the presence of "About Application" section
    test('Verify About Aplication setting and check "Tab" section', async () => {
        // Navigate to setting
        await functions.navigate_To_Settings();
        // Navigate to about applications
        await page.click(pageobject.aboutApplicationLink);
        await customAssert('Assert the lable of About application setting', async () => {
            await expect(page.locator(pageobject.aboutApplicationLink)).toHaveText('About application');
        });
        // assert the about application url
        await customAssert('page url should be /admin', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'admin', { TIMEOUT: 10000 });
        });
    });

    // Assert the presence of "Site identity" Tab
    test('Verify Site identity tab ant its elements', async () => {
        // validate Site identity tab of about application
        await functions.about_application_to_site_identity();
        await customAssert('Assert the lable of Site identity tab', async () => {
            await expect(page.locator(pageobject.siteidentitylocator)).toHaveText('Site identity');
        });
        // assert the site identity url
        await customAssert('page url should be /admin', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'admin');
        });
        // Assert the site name in Site identity tab is Saltcorn
        await customAssert('Assert the site name in Site identity tab is Saltcorn', async () => {
            await expect(page.locator(pageobject.inputsitename)).toHaveValue('Saltcorn');
        });
        // Assert the timezone in Site identity tab
        await customAssert('Assert the timezone in Site identity tab', async () => {
            await expect(page.locator(pageobject.inputtimezone)).toHaveValue('Africa/Abidjan');
        });
        // Assert the base_url in Site identity tab
        await customAssert('Assert the base_url in Site identity tab', async () => {
            await expect(page.locator(pageobject.inputbase_url)).toHaveValue('');
        });
        // Assert the site logo in Site identity tab
        await customAssert('Assert the site logo in Site identity tab', async () => {
            await expect(page.locator(pageobject.inputsite_logo)).toHaveValue('');
        });
        // Assert the favicon in Site identity tab
        await customAssert('Assert the favicon in Site identity tab', async () => {
            await expect(page.locator(pageobject.inputfavicon)).toHaveValue('');
        });
        // Assert the module store endpoint in Site identity tab
        await customAssert('Assert the module store endpoint in Site identity tab', async () => {
            await expect(page.locator(pageobject.modulestoreEndpoint)).toHaveValue('https://store.saltcorn.com/api/extensions');
        });
        // Assert the packs store endpoint in Site identity tab
        await customAssert('Assert the packs store endpoint in Site identity tab', async () => {
            await expect(page.locator(pageobject.packsstoreendpoint)).toHaveValue('https://store.saltcorn.com/api/packs');
        });
    });

    // Assert the presence of "Backup" tab
    test('Validate "Backup" tab and its elements', async () => {
        // validate Backup tab of about application
        await functions.about_application_to_backup();
        await customAssert('Assert the lable of Backup tab', async () => {
            await expect(page.locator(pageobject.backuplocator)).toHaveText('Backup');
        });
        // assert the backup url
        await customAssert('page url should be /admin/backup', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'admin' + derivedURL + 'backup');
        });
        // Assert the Download backup button availability
        await customAssert('Assert the Download backup button availability', async () => {
            await expect(page.locator(pageobject.downloadbackup)).toHaveText('Download a backup');
        });
        // Assert the restore backup button availability
        await customAssert('Assert the restore backup button availability', async () => {
            await expect(page.locator(pageobject.restorebackup)).toHaveText('Restore a backup');
        });
        // Assert the snapshot now button availability
        await customAssert('Assert the snapshot now button availability', async () => {
            await expect(page.locator(pageobject.snapshotbutton)).toHaveText('Snapshot now');
        });
        // Assert the list/download snapshots link availability
        await customAssert('Assert the list/download snapshots link availability', async () => {
            await expect(page.locator(pageobject.downloadsnapshot)).toHaveText('List/download snapshots »');
        });
        // Assert the Restore a snapshot link availability
        await customAssert('Assert the Restore a snapshot link availability', async () => {
            await expect(page.locator(pageobject.restoresnapshot)).toHaveText('Restore a snapshot');
        });
        // Assert the backup file prefix in backup tab
        await customAssert('Assert the backup file prefix in backup tab', async () => {
            await expect(page.locator(pageobject.backupfileprefix)).toHaveValue('sc-backup-');
        });
        // Assert that the backup history checkbox is checked
        await customAssert('Assert the backup history checkbox is checked', async () => {
            await expect(page.locator(pageobject.backuphistorycheckbox)).toBeChecked();
        });
    });

    // Assert the presence of "Email" tab
    test('Validate "Email" tab and its elements', async () => {
        // validate Email tab of about application
        await functions.about_application_to_email();
        await customAssert('Assert the lable of Email tab', async () => {
            await expect(page.locator(pageobject.emaillocator)).toHaveText('Email');
        });
        // assert the email url
        await customAssert('page url should be /admin/email', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'admin' + derivedURL + 'email');
        });
        // Assert the SMTP Host in Email tab
        await customAssert('Assert the SMTP Host in Email tab', async () => {
            await expect(page.locator(pageobject.smtp_host)).toHaveValue('');
        });
        // Assert the SMTP Username in Email tab
        await customAssert('Assert the SMTP username in Email tab', async () => {
            await expect(page.locator(pageobject.smtp_username)).toBeVisible();
        });
        // Assert the SMTP password in Email tab
        await customAssert('Assert the SMTP password in Email tab', async () => {
            await expect(page.locator(pageobject.smtp_password)).toBeVisible();
        });
        // Assert the SMTP port in Email tab
        await customAssert('Assert the SMTP port in Email tab', async () => {
            await expect(page.locator(pageobject.smtpport)).toHaveValue('25');
        });
        // Assert the Force TLS checkbox in Email tab
        await customAssert('Assert theForce TLS checkbox in Email tab in not checked', async () => {
            await expect(page.locator(pageobject.smtp_secure)).not.toBeChecked();
        });
        // Assert the Allow self assign checkbox in Email tab
        await customAssert('Assert the Allow self assign checkbox in Email tab in not checked', async () => {
            await expect(page.locator(pageobject.smtp_allow_self_signed)).not.toBeChecked();
        });
        // Assert Email from address section in Email tab
        await customAssert('Assert Email from address section in Email tab', async () => {
            await expect(page.locator(pageobject.email_from)).toHaveValue('');
        });
        // Assert test email button in Email tab
        await customAssert('Assert test email button in Email tab', async () => {
            await expect(page.locator(pageobject.testemailbutton)).toHaveText('Send test email');
        });
    });

    // Assert the presence of "System" tab
    test('Validate "System" tab and its elements', async () => {
        // validate System tab of about application
        await functions.about_application_to_system();
        await customAssert('Assert the lable of System tab', async () => {
            await expect(page.locator(pageobject.systemSettingsLink)).toHaveText('System');
        });
        // assert the System url
        await customAssert('page url should be /admin/system', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'admin' + derivedURL + 'system');
        });
        // Assert the System opration section
        await customAssert('Assert the System opration section', async () => {
            await expect(page.locator(pageobject.systemoperation)).toHaveText('System operations');
        });
        // Assert the Restart server button
        await customAssert('Assert the Restart server button', async () => {
            await expect(page.locator(pageobject.restartserver)).toHaveText('Restart server');
        });
        // Assert the Configuration check button
        await customAssert('Assert the Configuration check button', async () => {
            await expect(page.locator(pageobject.configcheck)).toHaveText('Configuration check');
        });
        // Assert the Clear all button
        await customAssert('Assert the Clear all button', async () => {
            await expect(page.locator(pageobject.clearAllButton)).toHaveText('Clear all »');
        });
        // Assert the about System section
        await customAssert('Assert the about System section', async () => {
            await expect(page.locator(pageobject.aboutsystem)).toHaveText('About the system');
        });
    });

    // Assert the presence of "Mobile App" tab
    test('Validate "Mobile App" tab and its elements', async () => {
        // validate Mobile app tab of about application
        await functions.about_application_to_mobile_app();
        await customAssert('Assert the lable of Mobile app tab', async () => {
            await expect(page.locator(pageobject.mobileapplocator)).toHaveText('Mobile app');
        });
        // assert the Mobile app url
        await customAssert('page url should be /admin/build-mobile-app', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'admin' + derivedURL + 'build-mobile-app');
        });
        // Assert the view link in mobile app tab
        await customAssert('Assert the view link in mobile app tab', async () => {
            await expect(page.locator(pageobject.viewNavLink)).toBeVisible();
        });
        // Assert the page link in mobile app tab
        await customAssert('Assert the page link in mobile app tab', async () => {
            await expect(page.locator(pageobject.pageNavLink)).toBeVisible();
        });
        // Assert the page group link in mobile app tab
        await customAssert('Assert the page group link in mobile app tab', async () => {
            await expect(page.locator(pageobject.pagegroupNavLink)).toBeVisible();
        });
        // Assert the android Checkbox checkbox in Mobile app tab
        await customAssert('Assert the android Checkbox checkbox in Mobile app tab in not checked', async () => {
            await expect(page.locator(pageobject.androidCheckbox)).not.toBeChecked();
        });
        // Assert the iOS Checkbox checkbox in Mobile app tab
        await customAssert('Assert the iOS Checkbox checkbox in Mobile app tab in not checked', async () => {
            await expect(page.locator(pageobject.iOSCheckbox)).not.toBeChecked();
        });
        // Assert the app name text box
        await customAssert('Assert the app name text box', async () => {
            await expect(page.locator(pageobject.appName)).toHaveValue('');
        });
        // Assert the app id text box
        await customAssert('Assert the app id text box', async () => {
            await expect(page.locator(pageobject.appId)).toBeVisible();
        });
        // Assert the app version text box
        await customAssert('Assert the app version text box', async () => {
            await expect(page.locator(pageobject.appVersion)).toHaveValue('');
        });
        // Assert the server URL text box
        await customAssert('Assert the server URL text box', async () => {
            await expect(page.locator(pageobject.serverURL)).toHaveValue('');
        });
        // Assert the app Icon text box
        await customAssert('Assert the app Icon text box', async () => {
            await expect(page.locator(pageobject.appIcon)).toHaveValue('');
        });
        // Assert the splash Page text box
        await customAssert('Assert the splash Page text box', async () => {
            await expect(page.locator(pageobject.splashPage)).toHaveValue('');
        });
        // Assert the auto Public Login checkbox in Mobile app tab
        await customAssert('Assert the auto Public Login checkbox in Mobile app tab in not checked', async () => {
            await expect(page.locator(pageobject.autoPublLogin)).not.toBeChecked();
        });
        // Assert the offline Mode checkbox in Mobile app tab
        await customAssert('Assert the offline Mode checkbox in Mobile app tab is not checked', async () => {
            await expect(page.locator(pageobject.offlineModeBox)).not.toBeChecked();
        });
        // Assert the debug redio button in Mobile app tab
        await customAssert('Assert the debug redio button in Mobile app tab is not checked', async () => {
            await expect(page.locator(pageobject.debugBuildType)).not.toBeChecked();
        });
        // Assert the release build redio button in Mobile app tab
        await customAssert('Assert the release build redio button in Mobile app tab is checked', async () => {
            await expect(page.locator(pageobject.releaseBuildType)).toBeChecked();
        });
        // check the keystore text box
        await customAssert('Assert the keystore text box', async () => {
            await expect(page.locator(pageobject.keystore)).toHaveValue('');
        });
        // check the provisioning Profile text box
        await customAssert('Assert the provisioning Profile text box', async () => {
            await expect(page.locator(pageobject.provisioningProfile)).toHaveValue('');
        });
        // check the build Mobile App Button
        await customAssert('Assert the build Mobile App Button', async () => {
            await expect(page.locator(pageobject.buildMobileAppBtn)).toHaveText('Build mobile app');
        });
    });

    // Assert the presence of "Development" tab
    test('Validate "Development" tab and its elements', async () => {
        // validate Development tab of about application
        await functions.about_application_to_development();
        await customAssert('Assert the lable of development tab', async () => {
            await expect(page.locator(pageobject.developmentlocator)).toHaveText('Development');
        });
        // assert the Development url
        await customAssert('page url should be /admin/dev', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'admin' + derivedURL + 'dev');
        });
        // Assert the development mode checkbox in development tab
        await customAssert('Assert the development mode checkbox in development tab is checked', async () => {
            await expect(page.locator(pageobject.development_mode)).not.toBeChecked();
        });
        // Assert the log sql to stdout checkbox in development tab
        await customAssert('Assert the log sql to stdout checkbox in development tab is checked', async () => {
            await expect(page.locator(pageobject.log_sql)).not.toBeChecked();
        });
        // Assert the log ip address checkbox in development tab
        await customAssert('Assert the log ip address checkbox in development tab is checked', async () => {
            await expect(page.locator(pageobject.log_ip_address)).not.toBeChecked();
        });
        //chech the system logging verbosity dropdown
        await customAssert('Assert the system logging verbosity dropdown', async () => {
            await expect(page.locator(pageobject.log_level)).toBeVisible();
        });
        // check the npm package textbox
        await customAssert('Assert the npm package textbox', async () => {
            await expect(page.locator(pageobject.npm_package)).toHaveValue('');
        });
        // check the log viewer link in development tab
        await customAssert('Assert the logs viewer link', async () => {
            await expect(page.locator(pageobject.logs_viewer)).toHaveText('open logs viewer');
        });
        // check the add page button in development tab
        await customAssert('Assert the add page button', async () => {
            await expect(page.locator(pageobject.addpageBtn)).toHaveText('Add page');
        });
    });

    // Assert the presence of "Notification" tab
    test('Validate "Notification" tab and its elements', async () => {
        // validate Notification tab of about application
        await functions.about_application_to_notification();
        await customAssert('Assert the lable of notifications tab', async () => {
            await expect(page.locator(pageobject.notificationlocator)).toHaveText('Notifications');
        });
        // assert the Notification url
        await customAssert('page url should be /admin/notifications', async () => {
            expect(page.url()).toBe(baseURL + derivedURL + 'admin' + derivedURL + 'notifications');
        });
        // Assert the In user menu checkbox in Notification tab
        await customAssert('Assert the In user menu checkbox in Notification tab is not checked', async () => {
            await expect(page.locator(pageobject.notification_in_menu)).not.toBeChecked();
        });
        // Assert the progressive web application Enabled checkbox in Notification tab
        await customAssert('Assert the progressive web application Enabled checkbox is not checked', async () => {
            await expect(page.locator(pageobject.pwa_enabled)).not.toBeChecked();
        });
    });
});