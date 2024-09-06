class PageLocators {
  constructor(page) {
    this.page = page;
    this.tryItNowLink = 'a[href="https://saltcorn.com/tenant/create"]';
    this.subdomainInput = 'input[name="subdomain"]';
    this.submitButton = 'button[type="submit"]';
    // this.successMessage = '#page-inner-content > section.page-section.pt-2 > div > div > div:nth-child(1)';
    // this.newApplicationLink = '#page-inner-content > section.page-section.pt-2 > div > div > div.my-3 > a';
    this.emailInput = 'input[type="email"]';
    this.passwordInput = 'input[type="password"]';
    this.textSource = 'div.wrap-builder-elem[title="Text"]';
    this.textlocator = '#saltcorn-builder > div.row > div.col-sm-auto.builder-sidebar > div > div.settings-panel.card.mt-1 > div.card-body.p-2 > div > div.border > div';
    this.inputbox1 = '#inputaddress';
    this.inputbox2 = '#inputdate_of_birth';
    this.saveprimarybutton = '#page-inner-content > div:nth-child(2) > div.d-inline > form > button';
    this.InputName = '#inputname';
    this.addFieldButtonLocator = 'a.btn.btn-primary.add-field.mt-2:has-text("Add field")';
        
    this.datelocator = 'span.flatpickr-day:has-text("14")';
    this.rowsperpage = '#input_rows_per_page';
    this.layoutoption = '#tab82036chead0';
    this.databaseoption = '#tab82036chead1';
    this.finishbutton = '#tab82036chead1 > button';
    this.target = 'div.canvas.root-canvas';
    this.destinationtype = '#inputdestination_type';
    this.destinationview = '#inputview_when_done';
    this.htmlCodeSource = 'div[title="HTML code"]';
    this.cardSource = 'div[title="Card"]';
    this.linkSource = 'div[title="Link"]';
    this.imageSource = 'div[title="Image"]';
    this.viewlinksource = 'div[title="Link to a view"]';
    this.newPageButton = 'a:has-text("Create page")';
    this.newPage_sidebar = 'span:has-text("Pages")';
    this.settingsTab = 'span:has-text("Settings")';
    this.settingdropdown='#collapseSettings > div';
    this.aboutApplicationLink = 'a.collapse-item:has-text("About application")';
    this.Modulesettingsidebar = '#collapseSettings > div > a:nth-child(2)';
    this.UsersAndSecurity = '#collapseSettings > div > a:nth-child(3)';
    this.SiteStructure = '#collapseSettings > div > a:nth-child(4)';
    this.File = '#collapseSettings > div > a:nth-child(5)';
    this.Events = '#collapseSettings > div > a:nth-child(6)';
    this.clearAllButton = 'a[href="/admin/clear-all"]';
    this.toasterSelector = '#toasts-area > div > div.toast-body.py-2.fs-6.fw-bold > strong';
    this.htmltextlocator = 'textarea.form-control';
    this.cardtextlocator = '//table//tr[1]//td//input';
    this.linklocator = '//table[1]//tr[1]//td[2]//input';
    this.linkurllocator = '//div[2]/div/table[1]//tr[3]//td[2]//input';
    this.expectedtoastermsg = 'Deleted all tables, views, pages, page_groups, files, triggers, eventlog, library, config, plugins';
    this.deletebutton = 'button.btn.btn-sm.btn-danger:has(svg[data-icon="trash-alt"])';
    this.clonebutton = 'button[title="Duplicate element with its children"]';
    this.CardUrl = '//table//tr[2]//td//input';
    this.click_table='a[href="/table"]';
    this.createtablebutton='a[href="/table/new"]';
    this.SaltCornButton='#accordionSidebar > a > div';
    this.createviewbutton='#accordionSidebar > li.nav-item.active > a';
    this.sidebarviewbutton='#accordionSidebar > li:nth-child(5) > a';
    this.createnewview = 'a[href="/viewedit/new"]';
    this.createtablefromCSV = 'a[href="/table/create-from-csv"]';
    this.homeCSVuplaod = 'a:has-text("CSV upload")';
    this.Defaultusertable = 'a[href="/table/1"]';
    this.Yourtabletab = 'a.nav-link.active:has-text("Your tables")';
    this.relationshipdiagram = 'a[href="/table/relationship-diagram"]';
    this.discoverbutton = 'a[href="/table/discover"]';
    this.Home_new_page_button = 'a:has-text("Create page")';
    this.siteidentitylocator = 'a.nav-link.active:has-text("Site identity")';
    this.backuplocator = 'a[href="/admin/backup"]';
    this.emaillocator = 'a[href="/admin/email"]';
    this.systemSettingsLink = 'a[href="/admin/system"]';
    this.mobileapplocator = 'a[href="/admin/build-mobile-app"]';
    this.developmentlocator = 'a[href="/admin/dev"]';
    this.notificationlocator = 'a[href="/admin/notifications"]';
    this.AllModuleslocator = 'a[href="/plugins?set=all"]';
    this.Moduleslocator = 'a[href="/plugins?set=modules"]';
    this.packslocator = 'a[href="/plugins?set=packs"]';
    this.themeslocator = 'a[href="/plugins?set=themes"]';
    this.Installedlocator = 'a[href="/plugins?set=installed"]';
    this.userslocator = '//a[contains(@class, "nav-link active") and contains(text(), "Users")]';
    this.roleslocator = 'a[href="/roleadmin"]';
    this.loginandsignup = 'a[href="/useradmin/settings"]';
    this.tableaccess = 'a[href="/useradmin/table-access"]';
    this.httplocator = 'a[href="/useradmin/http"]';
    this.permissionslocator = 'a[href="/useradmin/permissions"]';
    this.menulocator = 'a[href="/menu"]';
    this.searchtablocator = 'a[href="/search/config"]';
    this.librarylocator = 'a[href="/library/list"]';
    this.languagelocator = 'a[href="/site-structure/localizer"]';
    this.pagegroupslocator = 'a[href="/page_group/settings"]';
    this.tagslocator = 'a[href="/tag"]';
    this.diagramlocator = 'a[href="/diagram"]';
    this.registrylocator = 'a[href="/registry-editor"]';
    this.fileslocator = 'a.nav-link.active:has-text("Files")';
    this.storagelocator = 'a[href="/files/storage"]';
    this.Filesettinglocator = 'a[href="/files/settings"]';
    this.trigerslocator = 'a.nav-link.active:has-text("Triggers")';
    this.Customlocator = 'a[href="/eventlog/custom"]';
    this.logsettinglocator = 'a[href="/eventlog/settings"]';
    this.Eventloglocator = 'a[href="/eventlog"]';
    this.discriptiontext = '#inputdescription';
    this.viewtabledropdown = '#inputtable_name';
    this.viewminimumroledropdown = '#inputmin_role';
    this.choosefilebutton = '#inputfile';
    this.createviewfromtable = '#table-views > div > a';
    this.textstyle = '.form-control form-select';
    this.createuserlink = 'a[href="/useradmin/new"]';
    this.inputdob = '#inputdob';
    this.inputemail = '#inputemail';
    this.inputrole_id = '#inputrole_id';
    this.inputrnd_password = '#inputrnd_password';
    this.inputpassword = '#inputpassword';
    this.createuserbutton = 'button[type="submit"]:has-text("Create")';
    this.searchbar = 'input[type=search]';
    this.userdropdown = '#content > div.dropdown-menu.dropdown-menu-end.show';
    this.deleteuser = '#content > div.dropdown-menu.dropdown-menu-end.show > a:nth-child(11)';
    
    this.mytable = 'a:has-text("My_Table")';
    this.saveactionbutton = '//button[text()="Save"]';
    this.EditlinkLocator = 'a:has(i.fas.fa-2x.fa-edit)';
    this.downloadlinklocator = 'a:has(i.fas.fa-2x.fa-download)';
    this.uploadcsvlinklocator = 'label:has-text("Upload CSV")';
    this.addrowlocator = 'button.btn.btn-sm.btn-primary.me-2:has-text("Add row")';
    this.fieldsourrce = '//div[@title="Field"]';
    this.createfromcsvupload = '//a[@href="/table/create-from-csv"]';
    this.ActionLocator = 'div[title="Action button"]';
    this.lebelforfield = 'input[class*="viewlink-label"]';
    this.editviewlink = 'a.ms-2 i.fas.fa-edit';
    this.finishbuttonprimary = '//button[@type="submit" and contains(@class, "btn-primary") and text()="Finish »"]';
    this.nextoption = 'button:has-text("Next »")';
    this.finishprimary = '[role="button"][name="Finish »"]';
    this.calendarlocator = 'div.flatpickr-calendar.hasTime.animate.open.arrowTop.arrowLeft';
    this.yearlocator = 'input.numInput.cur-year';
    this.monthlocator = 'select.flatpickr-monthDropdown-months';
    this.addressvariablelocator = '(//code[text()="address"])[1]';
    this.DOBvariablelocator = '(//code[text()="date_of_birth"])[1]';
    this.fullnamevariablelocator = '(//code[text()="full_name"])[1]';
    this.fullnamefieldlocator = '//td[text()="Full name"]';
    this.dobfieldlocator = '//td[text()="Date of birth"]';
    this.addressfieldlocator = '//td[text()="Address"]';
    this.datetypelocator = '//td[text()="Date"]';
    this.Fullnameshow = 'div.d-inline:has-text("Full name")';
    this.fullnameuser = 'div.d-inline:has-text("First Name")';
    this.csvnamestringtype = '(//td[text()="String"])[2]';
    this.csvaddressstringtype = '(//td[text()="String"])[1]';
    this.deleteviewbutton = '(//a[text()="Delete"])[1]';
    this.editfieldlink = '(//a[text()="Edit"])[1]';
    this.showfieldlink = '(//a[text()="Show"])[1]';
    this.ActionLabel = 'input[type="text"].form-control';
    this.ActionHoverTitle = 'input.form-control:not([type])';
    this.containsdraglocator= 'div[title="Container"]';
    this.containerdisplaysetting = '//div[contains(text(), "Display")]';
    this.containercontentsetting = '//div[contains(text(), "Contents")]';
    this.containerflexsetting = '//div[contains(text(), "Flex properties")]';
    this.containercontentlink = '//div[contains(text(), "Container link")]';
    this.containercustomclass = '//div[contains(text(), "Custom class/CSS")]';
    this.SearchLocator= 'div[title="Search bar"]';  
    this.hasdropdowncheckbox = '//div[2]/div/div[1]/input[@type="checkbox"]';
    this.Autofocuscheckbox = '(//input[@class="form-check-input" and @name="block"])[3]';
    this.statebadgecheckbox = '(//input[@class="form-check-input" and @name="block"])[2]';
    this.saveButton = 'button.builder-save:has-text("Done »")';
    this.addcolumnbutton = 'button:has-text("Add column")';
    this.newcolumn1 = 'div:nth-child(4) > div:nth-child(2) > .canvas';
    this.newcolumn2 = 'div:nth-child(5) > div:nth-child(2) > .canvas';
    this.newcolumn3 = 'div:nth-child(6) > div:nth-child(2) > .canvas';
    this.newviewlink = 'a[href="/view/NewView_List"]';
    this.addpersonlink = 'a:has-text("Add person")';
    this.newviewfromtable = 'a[href="/view/csvView_list"]';
    this.Homecreateview = 'a:has-text("Create view")';
    this.viewpatterndropdown = '#inputviewtemplate';
    this.idfieldlocator = '//td[text()="ID"]';
    this.idtypelocator = '//td[text()="Integer"]';
    this.Stringtypelocator = '//td[text()="String"]';
    this.tab1locater = 'div.tabulator-cell[tabulator-field="full_name"]';
    this.tab2locator = 'div.tabulator-cell[tabulator-field="date_of_birth"]';
    this.tab3locator = 'div.tabulator-cell[tabulator-field="address"]';
    this.minlengthlocator = '//input[@id="inputmin_length"]';
    this.maxlengthlocator = '//input[@id="inputmax_length"]';
    this.viewtocreate = '#inputview_to_create';
    this.labeltocreate = '#inputcreate_view_label';
    this.fielddropdown = '(//select[@class="form-control form-select"])[1]'
    this.view2editoption = 'text=View2_Edit [Edit] My_Table';
    this.view2showoption = 'text=showView [Show] My_Table';
    this.viewtolinkdropdown = '//div[contains(@class, "css-1uccc91-singleValue")]';
    this.deletefieldbutton = '//i[@class="fas fa-trash-alt"]';
    this.errormessagelocator = '//input[@id="inputre_invalid_error"]';
    this.descriptionSelector = '//input[@id="inputdescription"]';
    this.RequiredcheckboxLocator = "//input[@id='inputrequired' and @type='checkbox']";
    this.labelTextboxlocator = '//input[@id="inputlabel"]';
    this.fullnamerequiredtaglocator = '(//span[@class="badge bg-primary" and text()="Required"])[1]';
    this.inputsitename = '#inputsite_name';
    this.inputtimezone = '#inputtimezone';
    this.inputbase_url = '#inputbase_url';
    this.inputsite_logo = '#inputsite_logo_id';
    this.inputfavicon = '#inputfavicon_id';
    this.modulestoreEndpoint = '#inputplugins_store_endpoint';
    this.packsstoreendpoint = '#inputpacks_store_endpoint';
    this.downloadbackup = 'button:has-text("Download a backup")';
    this.restorebackup = 'label:has-text("Restore a backup")';
    this.snapshotbutton = '#btnSnapNow';
    this.downloadsnapshot = 'a[href="/admin/snapshot-list"]';
    this.restoresnapshot = 'label:has-text("Restore a snapshot")';
    this.backupfileprefix = '#inputbackup_file_prefix';
    this.backuphistorycheckbox = '#inputbackup_history';
    this.smtp_host = '#inputsmtp_host';
    this.smtp_username = '#inputsmtp_username';
    this.smtp_password = '#inputsmtp_password';
    this.smtpport = '#inputsmtp_port';
    this.smtp_secure = '#inputsmtp_secure';
    this.smtp_allow_self_signed = '#inputsmtp_allow_self_signed';
    this.email_from = '#inputemail_from';
    this.testemailbutton = '#testemail';
    this.restartserver = 'button.btn.btn-primary:has-text("Restart server")';
    this.configcheck = 'a.btn.btn-info:has-text("Configuration check")';
    this.systemoperation = 'h5.m-0.fw-bold.text-primary.d-inline:has-text("System operations")';
    this.aboutsystem = 'h5.m-0.fw-bold.text-primary.d-inline:has-text("About the system")';
    this.viewNavLink = '#viewNavLinkID';
    this.pageNavLink = '#pageNavLinkID';
    this.pagegroupNavLink = '#pagegroupNavLinkID';
    this.androidCheckbox = '#androidCheckboxId';
    this.iOSCheckbox = '#iOSCheckboxId';
    this.appName = '#appNameInputId';
    this.appId = '#appIdInputId';
    this.appVersion = '#appVersionInputId';
    this.serverURL = '#serverURLInputId';
    this.appIcon = '#appIconInputId';
    this.splashPage = '#splashPageInputId';
    this.autoPublLogin = '#autoPublLoginId';
    this.offlineModeBox = '#offlineModeBoxId';
    this.debugBuildType = '#debugBuildTypeId';
    this.releaseBuildType = '#releaseBuildTypeId';
    this.keystore = '#keystoreInputId';
    this.provisioningProfile = '#provisioningProfileInputId';
    this.buildMobileAppBtn = '#buildMobileAppBtnId';
    this.development_mode = '#inputdevelopment_mode';
    this.log_sql = '#inputlog_sql';
    this.log_ip_address = '#inputlog_ip_address';
    this.log_level = '#inputlog_level';
    this.npm_package = '#inputnpm_available_js_code';
    this.logs_viewer = 'a.d-block[href="dev/logs_viewer"]';
    this.addpageBtn = 'button.btn.btn-secondary.btn-sm.d-block.mt-2';
    this.notification_in_menu = '#inputnotification_in_menu';
    this.pwa_enabled = '#inputpwa_enabled';
    this.questionIconLocator = '.fas.fa-question-circle.ms-1';
    this.modalTitleLocator = '.modal-title:has-text("Help: User roles")';
    this.closeButtonLocator = '.btn-close[data-bs-dismiss="modal"]';
    this.addnewrole = 'a:has-text("Add new role")';
    this.allowSignupCheckbox = '#inputallow_signup';
    this.loginMenuCheckbox = '#inputlogin_menu';
    this.allowForgotCheckbox = '#inputallow_forgot';
    this.newUserFormDropdown = '#inputnew_user_form';
    this.loginFormDropdown = '#inputlogin_form';
    this.signupFormDropdown = '#inputsignup_form';
    this.userSettingsFormDropdown = '#inputuser_settings_form';
    this.verificationViewDropdown = '#inputverification_view';
    this.logoutUrlTextbox = '#inputlogout_url';
    this.signupRoleDropdown = '#inputsignup_role';
    this.elevateVerifiedDropdown = '#inputelevate_verified';
    this.emailMaskTextbox = '#inputemail_mask';
    this.ownershipFieldDropdown = '#inputownership_field_id';
    this.minRoleReadDropdown = '#inputmin_role_read';
    this.minRoleWriteDropdown = '#inputmin_role_write';
    this.cookieDurationTextbox = '#inputcookie_duration';
    this.cookieDurationRememberTextbox = '#inputcookie_duration_remember';
    this.publicCacheMaxageTextbox = '#inputpublic_cache_maxage';
    this.codeMirrorLine = '.CodeMirror-line';
    this.minRoleUploadSelect = '#inputmin_role_upload';
    this.minRoleApikeygenSelect = '#inputmin_role_apikeygen';
    this.minRoleSearchSelect = '#inputmin_role_search';
    this.idNumberInput = '#inputid';
    this.roleTextInput = '#inputrole';
    this.userNavLink = 'a[data-bs-target="#collapseUser"]';
    this.userSettingsLink = 'a.collapse-item >> text="User Settings"';
    this.logout = 'a[href="/auth/logout"]';
    this.TriggerTitle = 'h5:has-text("Triggers")';
    this.CreateTriggerBtn = 'a:has-text("Create trigger")';
    this.actionsAvailable = 'td:has-text("Actions available")';
    this.eventTypesCell = 'td:has-text("Event types")';
    this.newtriggertitle = 'h5:text("New trigger")';
    this.whentrigger = '#inputwhen_trigger';
    this.inputtableid = '#inputtable_id';
    this.inputaction = '#inputaction';
    this.chanelcheckbox = '#inputhasChannel';
    this.CreateEventbtn = 'a:has-text("Create custom event")';
    this.eventsSettingsheader = 'h5:has-text("Events and Trigger settings")';
    this.periodicTimingHeader = 'h5:has-text("Periodic trigger timing (next event)")';
    this.nextHourlyEventInput = 'input[name="next_hourly_event"]';
    this.nextDailyEventInput = 'input[name="next_daily_event"]';
    this.nextWeeklyEventInput = 'input[name="next_weekly_event"]';
    this.whichEventsShouldBeLogged = 'h5:has-text("Which events should be logged?")';
    this.insertCheckbox = 'input#inputInsert';
    this.updateCheckbox = 'input#inputUpdate';
    this.validateCheckbox = 'input#inputValidate';
    this.deleteCheckbox = 'input#inputDelete';
    this.weeklyCheckbox = 'input#inputWeekly';
    this.dailyCheckbox = 'input#inputDaily';
    this.hourlyCheckbox = 'input#inputHourly';
    this.oftenCheckbox = 'input#inputOften';
    this.apiCallCheckbox = 'input#inputAPI\\ call';
    this.neverCheckbox = 'input#inputNever';
    this.pageLoadCheckbox = 'input#inputPageLoad';
    this.loginCheckbox = 'input#inputLogin';
    this.loginFailedCheckbox = 'input#inputLoginFailed';
    this.errorCheckbox = 'input#inputError';
    this.startupCheckbox = 'input#inputStartup';
    this.userVerifiedCheckbox = 'input#inputUserVerified';
    this.eventLogHeading = 'h5:has-text("Event log")';
    this.whenHeader = 'th:has-text("When")';
    this.typeHeader = 'th:has-text("Type")';
    this.channelHeader = 'th:has-text("Channel")';
    this.breadcrumbSvgLocator = 'ol.breadcrumb li.breadcrumb-item svg';
    this.searchInputLocator = 'input.search-bar[placeholder="Search Files"]';
    this.filenameLocator = 'th:has-text("Filename") svg';
    this.mediaTypeLocator = 'th:has-text("Media type")';
    this.sizeColumnLocator = 'th:has-text("Size (KiB)")';
    this.roleToAccessColumnLocator = 'th:has-text("Role to access")';
    this.createNewFolder = 'td:has-text("Create new folder...")';
    this.fileInputLocator = 'input[type="file"][name="file"]';
    this.PageHeader = 'h5.text-primary'; 
    this.s3EnabledCheckbox = 'input[type="checkbox"][name="storage_s3_enabled"]'; 
    this.s3BucketInput = 'input[type="text"][name="storage_s3_bucket"]';
    this.s3PathPrefixInput = 'input[type="text"][name="storage_s3_path_prefix"]';
    this.s3EndpointInput = 'input[type="text"][name="storage_s3_endpoint"]';
    this.s3RegionInput = 'input[type="text"][name="storage_s3_region"]'; 
    this.s3AccessKeyInput = 'input[type="text"][name="storage_s3_access_key"]';
    this.s3AccessSecretInput = 'input[type="password"][name="storage_s3_access_secret"]';
    this.s3SecureCheckbox = 'input[type="checkbox"][name="storage_s3_secure"]';
    this.minRoleUploadSelect = 'select[name="min_role_upload"]';
    this.fileAcceptFilterInput = 'input[type="text"][name="file_accept_filter_default"]';
    this.filesCacheMaxAgeInput = 'input[type="number"][name="files_cache_maxage"]';
    this.fileUploadDebugCheckbox = 'input[type="checkbox"][name="file_upload_debug"]';
    this.fileUploadLimitInput = 'input[type="number"][name="file_upload_limit"]';
    this.fileUploadTimeoutInput = 'input[type="number"][name="file_upload_timeout"]';
    this.typeDropdown = 'select[name="type"]';
    this.viewnameDropdown = 'select[name="viewname"]';
    this.textInput = 'input[type="text"][name="text"]';
    this.iconPickerButton = 'button[id="myEditor_icon"]';
    this.tooltipInput = 'input[type="text"][name="tooltip"]';
    this.minRoleDropdown = 'select[name="min_role"]';
    this.disableOnMobileCheckbox = 'input[type="checkbox"][name="disable_on_mobile"]';
    this.targetBlankCheckbox = 'input[type="checkbox"][name="target_blank"]';
    this.inModalCheckbox = 'input[type="checkbox"][name="in_modal"]';
    this.styleDropdown = 'select[name="style"]';
    this.locationDropdown = 'select[name="location"]';
    this.updateButton = 'button[id="btnUpdate"]';
    this.addButton = 'button[id="btnAdd"]';
    this.recalculateButton = 'button[id="btnRecalc"]';
    this.alertDanger = 'div.alert.alert-danger[role="alert"]';
    this.controlFlowCategory = 'div#blockly-0';
    this.logicCategory = 'div#blockly-1';
    this.mathCategory = 'div#blockly-2';
    this.textCategory = 'div#blockly-3';
    this.rowsCategory = 'div#blockly-4';
    this.listsCategory = 'div#blockly-5';
    this.actionsCategory = 'div#blockly-6';
    this.variablesCategory = 'div#blockly-7';
    this.testRunLink = 'a:has-text("Test run")';
    this.successmessage = '.toast-header.bg-success.text-white.py-1';
    this.deleteLink = 'a:has-text("Delete")';
    this.notifyTypeDropdown = 'select[name="notify_type"]';
    this.textInput = 'input[name="text"]';
    this.toastMessage = 'div.toast[role="alert"][aria-live="assertive"]';
    this.closetoast = 'button.btn-close[data-bs-dismiss="toast"]';
  }
}

module.exports = PageLocators;
