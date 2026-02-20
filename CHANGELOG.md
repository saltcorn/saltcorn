# Notable changes

## 1.6.0 - In development

* Elements can now be added to the top right (left in RTL languages) of cards, if a title is given.

* List views now have a "Tree Field" option, for self-join keys, to show the rows as a tree as an indented indicator in the first column. If a tree field is chosen, sorting by joinfields and aggregations is disabled. 

* Added Filipino, Romanian, Urdu and Korean languages

* Keyboard shortcuts can be defined for menu items

* The builder is now based on craft.js 0.2.12 and the drag-and-drop is much improved

* The `res` is now available in actions, allowing you to, for instance, set cookies

* Set additional workflow context in the builder when a workflow action is selected

* Entities list: search modules and users, multiselect with delete, deep search option, keyboard shortcuts

* Instances run in multi-node mode will now automatically select a leader to run the schedule

* Rows in provided tables can now be owned, set by a field or a formula

* The workflow editor has been completely rewritten, based on react-flow.

* Pages based on HTML files can now embed views. If the html file contains an `<embed-view>` tag, it will be replaced with the contents of a view. Use the `viewname` attribute to set the view name, and the remaining attributes to set the view state.

* There is now a link to edit text-based files in the file manager.

* Interpolations:
    - Now based on vm2
    - Re-interpolation: where interpolations as usable, use `{{= expression }}` to specify that the content of expression should be reprocessed for interpolations.
    - The standard evaluation context is now available in interpolations

* Mobile: iOS periodic/push-based sync. Improved mobile builder UI.

* Reduce the number of network requests in Edit forms with complex logic

## 1.5.0 - Released 26 January 2026

* thumbs_up_down fieldview for booleans fields, as an alternative to tristate

* Workflow EditViewForm previously ignored the response variable setting for writing data. This is now correctly used to set the data to a context variable. If you use the EditViewForm, this is will likely break your workflow.

* Workflow EditViewForm steps can now be used with Edit-in-Edit (An Edit view with an embedded Edit view based on a child). Uee this to allow the user to edit arrays in a workflow context.

* `copy_to_clipboard action, based on interpolations.

* The SQL `ANALYZE` command is now run daily on ever table that contains an index.

* A new docker image has all available modules pre-installed. This allows you to build application completely isolated from the internet. 

* Ability to run asynchronous code in code pages. Use this for instance to set constants in the global environment from database tables

* Builder: 
    - set the horizontal aligment and background colour or background image of cards. 
    - Embed pages in Filter and Show views (previously only in other pages). 
    - Option to apply select2, if installed as a module, to drop down filters.

* The option to store files in S3-compatible services instead of on local disk is now working again. 

* Joinfields in formulas can now be accessed by using a Claudian half-H (Ⱶ) instead of a dot. This avoids a non-determinism where adding a join field to a formula would change the type of the key field from a value to an expanded object, a source of much confusion and app breakage. The half-H expressions are available with autocomplete in formula inputs.

* Improved code editor based on Monaco, with intellisense autocomplete. This is also applied to some one-line formula inputs

* Mobile applications: 
    - upgrade to capacitor 7. Node 20+ is now required to build mobile application
    - Push/Periodic sync option: option to sync on-device tables periodically or with server push as the data changes
    - Field level conflict resolution on sync

* Support for RTL languages. Currently works with sb-admin2 and material-design themes. 

* Multi-node support: Updates other Saltcorn nodes when data changes or real-time events using PostgreSQL LISTEN/NOTIFY. Disabled by default (see README).

* Mail queue: The mail throttle time (in Notification settings) controls how many email notifications are sent to the same user. When the queue is empty, a notification is sent immediately; otherwise, all emails are combined and sent after the throttle time has passed.

* Entities list - a new page for admin at `/entities`, a filterable, searchable list of all entities (tables, views, pages and triggers). 

* Airgap configuration option - informs Saltcorn that it is in an isolated network environment - prevents background connections to npm and the Saltcorn module store but does not enforce isolation in user or admin actions.

* Performance enhancements for large tables and large file counts. Options to disable sort order and full pagination count. 

* Light mode variables: `user.lightDarkMode` to detect mode

* Lazy view settings in tab elements (tabs, accordions and pills). Any views inside the tab will be loaded when the tab is displayed. 

* Table.updateRow and insertRow now always runs their triggers syncronously. Async trigger runs caused problems when in transactions.

* Files can now be uploaded with the Save form_action button

* Show-if expressions in menu items and page containers

### Security

* Several [XSS vulnerabilities](https://github.com/saltcorn/saltcorn/security/advisories/GHSA-cr3w-cw5w-h3fj) were discovered by Mathis Zscheischler. These allow an attacker who can trick a logged-in administrator into clicking a malicious link to run arbitrary client-side JavaSscript, which can be exploited for session hijacking, site reconfiguration or command injection.

## 1.4.2 - Released 14 January 2026

Backport the security fix from 1.5.0

## 1.4.1 - Released 19 November 2025

* Dropdown option for List header filters - mutually exclusive with togglable header filters. Filters are activated with a hidden (revealed on hover) dropdown menu.

* Bug fixes backported from 1.5.0 branch

## 1.4.0 - Released 24 October 2025

* When PageLoad triggers return directives (`notify`, `eval_js` etc.) these are now run on the the 
  client page.

* When Table.deleteRows is called without a user argument, it implicitly has admin access, to make 
  it consistent with other methods

* Some initial and limited support for composite primary keys in discovered and external tables. 

* insert_any_row action:
    * now accepts a list of rows in its row expression and will insert all of them.
    * if the primary key value is set in the row expression, it will upsert the row (update if a row with this primary key value exists, otherwise insert)

* Actions now have an option to run asynchronously from the builder action settings. If this is enabled, and dynamic updates are enabled, the action will run in the background instead of during a HTTP request. This is more robust for long-running actions; there should be no difference in user experience. 

* `progress_bar` action: Display or update the display of a progress message. This can appear in a toast message for actions that can run in parallel; or in a blocking popup-up modal if the progress display is required to freeze the user interface.

* List view now have options for header filters, row colour by formula,  table layout setting (corresponds to table-layout CSS property) and sticky header.

### Security

* Filter aggregations (count, average over a table subset) previously ignored ownership. There is now a partial implementation of the owbership restriction, however this is still incomplete for ownership formulas involving joinfields. 
* When serving HTML files that have been uploaded to the file store, the mime type is now set to text/plain (unless the user is the owner of the file) to prevent user-uploaded files performing session hijacking. This can be disabled in the securioty settings if you trust all uploaded html files and need to serve them.. MathJax and svg files are cleaned with dompurify before serving. Reported by luriel at Hakai Security.
* It was previously possibly for a logged-in user to craft a request to change their own password without supplying their old password. This is now checked. Reported by luriel at Hakai Security.


### Fixes

* Fix formula constraints to support more translations to SQL
* Edit: preserve file choices on form errors.
* Fix format fieldview for only day Dates.
* Fix full screen width on containers - this conflicted with position, which it now overrides.
* Fix jsdoc links from code editor
* Fix date parsing when using flatpickr with locale and format


## 1.3.1 - Released 31 August 2025

* Reduce client assets for some plugins - if a view is not available for a role, its assets can be omitted. 

* List view have options for header filters and responsive collapse (under layout options). Header filters place small filters in the table header. Responsive collapse lets you set a breakpoint where the list transitions to a vertical display.

* Real time collaboration for Edit views. Form fields will update in real time as they change in the database. An event can be chosen to run on update.

* loop_rows action: repeat an action for a all or some rows in a table, including an option for a random selection of rows.

* train_model_instance action: (re)train a (predictive analytics) model instance

* Visibility toggle option for password fieldviews. Click an eye icon to show password

* Enable/disable push notifications per-role in the Users role table.

* Table triggers (Insert, Update, Delete) and Login and PageLoad can now be limited with an only-if formula.

* Date fields with the day only attribute are now handled internally without time or timezone from the database to the client. This should lead to more reliable date handling.

* The menu can now be fully customized from the menu editor, including the admin items (Tables, Vies, Pages and Settings) and the user items (login/signup and the user menu)

* Events can now be sent from a running server scripts to the user's client page. Run the `emit_to_client()` function with the same objects that can be returned from a run_js_code action. For instance: `emit_to_client({notify: "hello admin"}, 1)` will make a toast appear on any tab loaded by the user with ID=1. This facility can be disabled for high performance, less interactive applications, under Event log settings.

* Link, Action and Dropdonw menu buttons are now always the same height.

* List views have a vertical aligment option under Layout options. Use this to adjust the vertical alignment of each cell. The default is middle.

* Provided tables can now by writable (delete, insert and update). For an example of this see the history-control table provider

* Imported CSVs rows can now have a blank in the primary key column, which will be treated as an insert.


## 1.3.0 - Released 2 July 2025

* It is no longer necessary to restart the application when upgrading a plugin to a more recent version

* Option to disable tsvector full-text search in the search settings. This will use ILIKE to search, which is slower, but can match the middle a phrase in the middle of the word

* Push notifications for PWA and web applications. 

* select_by_code fieldview for editing Key, String or Integer fields: populate the dropdown options by running code.

* Edit views: in formulae, for instance in show if containers, the variable `_creating` now indicates if a new row is being created (true) or exisitng row being edited (false)

* Date fields with "only day" are now stored with the "date" type in PostgreSQL.

* Aggregation formulae: In view formulae, you can now use aggregation formulae. The syntax for this is `{inbound_table}${inboundkey_field}${target_field}${aggrgation}` The aggregation (which should be lower case) can be ommitted and defaults to `array_agg`. Examples: `patients$favbook$id$count` or `patients$favbook$id`. This is useful if you want a count in a view link label without creating a stored calculated field.

* Builder:
    - List columns can have containers in columns, and multiple elements in each column
    - Cut, copy and paste the selected element with keyboard (Ctrl- or Cmd-x/c/v)

* Template generation: generate basic views from template tables. 

* Login and signup from any edit view on users. Login respond to trigger results (goto URL, toast notifications).

* Real-time collaboration foundations. Views patterns must be adapted to take advantage of this. 

* View embeddings in Edit are now live and respond to changes in Key field values if embedded views are based on this relations.

* S3 automated backup destination. Optional password for backups

* refresh_user_session action: run then the sessions user variable needs to be
  updated because the users table row has changed.

### Fixes

* Restore partial matches with full text search
* Several mobile builder fixes

## 1.2.0 - Released 21 May 2025

* Create Table by CSV upload now accepts String and UUID primary keys and 
  JSON fields (if UUID and JSON modules are installed)

* Table read permissions are now strictly enforced in all filter dropdowns. 
  Previously, this was enforced in Field elements but not DropDownFilter elements.
  The user must now have read permission to the table that fills the options
  in the select dropdown.

* Warn if restoring a backup from a more recent version of Saltcorn

* Table.compress_history can now delete unchanged rows

* Fixed configuration variables (`fixed_configuration` in configuration file)
  are now hidden from backups and the user configuration. This allows you to
  use this better for configuration secrets

* send_email action: Option to set locale

### Fixes

* Allow actions in room edit views
* Save form action with file fields

## 1.1.4 - Released 28 April 2025

* Admin can disable 2FA for any user. 

* Introduce an API for discovering SQL columns in types provided by modules, 
  which have type modifiers (e.g. vector length in pgvector)

* List: Enabling Row click action or link no longer breaks Links, actions
  and dropdown menus in columns

* Email server can be authorized with OAuth. Use GraphAPI for Microsoft 
  email servers.

* Role IDs 2-10 are now available for use. As a consequence, backups from before Saltcorn 0.8.7 can no
  longer be restored. To restore a backup from 0.8.6, restore on Saltcorn any version 0.8.7 - 1.0 
  and then backup again.

* Admin table data edit improvements:
    - Change layout which should work better with many fields
    - When editing Key fields, the values in the dropdown are sorted and NULL (blank) is first
    - Show/hide all/none fields link
    - Update tabulator version

* Translations: 
    - upload and download CSV files with the translation strings (under Site structure/Languages)
    - Text nodes inside HTML elements are translated
    - The site name and addiotnal login strings are translated
    - Translate app strings with LLM if module is present
    - Translate Action and viewlink labels, list headers and page and popup titles.
    - Options from String field attributes can now be translated.


* Transactional isolation: Most administrative actions and user-run data 
  manipulation through forms or actions run from the web UI are now
  transactionally isolated.

* Option to disable CSRF token check from some routes (HTTP settings)

### Fixes

* Fix broken customized reset password email from 1.1.3
* 3152: Use actions in a feed's empty view
* 3066: Give error message on faulty interpolation in page title
* 3054: Use !==, >, >= etc in dynamnic where in Edit
* 2893: Fix link to manage tags in table admin
* 2821: use tables element in emails
* 3186: Admin user edit no longer clears file fields on user
* 3184: Fix delete columns in list views embedded in Edit views

## 1.1.3 - Released 25 March 2025

* A POST route for the reload management api (`/scapi/reload`) which takes as body JSON
  a newly created tenant with `saltcorn create-tenant` CLI (`new_tenant` JSON key) or an
  existing tenant (`tenant` JSON key) to reload.

* User authentication methods (password, external identity providers) can 
  now be disabled by role

* Customize reset password email, under Login and Signup settings

* Snapshot and restore code pages; show code page compilation error; expand code 
  editor height to fill screeen.

* Toast action can now set the title

* List view: Row click can now open in a new tab, in a popup, or can run an action.

* Create basic views: if a table had no views, a button on the table page 
  allows you to build basic views for the table with a single click

* Workflows: 
    - UserForm new question type: Multiple checks
    - Options for Multiple checks and Multiple choice can use interpolations (`{{ }}`)
      so options can be dynamically generated from the context
    - Improve UX for editing For Loops.
    - UserForm multiple choice switch to dropdown if >5 options

### Fixes

* Fix serving JSDoc (Table, File, User links in run_js_code)
* Destination redirect on login now works on custom login forms and with external identity providers
* insert_any_row now works from pages
* Fix various capacitor build errors.

## 1.1.2 - Released 4 March 2025

* Actions:
    - New action: download_file_to_browser
    - Workflows on mobile apps

* Email: 
    - Improve button appearance
    - All links are absolute
    - Option to use unauthenticated SMTP

* Builder:
    - Container background image by file field in Show views
    - Container opacity setting
    - Set custom class on links and actions
    - Fix error toast when saving on Firefox
    - Set action to be submit action - action run on enter keypress.

* Restore large backups: stream JSON files to database, use system unzip

* Handle multiple fields with same name in Edit.

* Upgrade a large number of dependencies (express, typescript, oclif, pg, webpack, typescript, axios, mjml, svelte). Node.js 18+ is require for this release. 

### Security

* View roles are now strictly enforced, including when views are embedded.

### Fixes

* Much work on primary keys not called "id"

## 1.1.1 - Released 2 February 2025

* Full-text search improvements: 
    - An index for full-text search can now be created. When creating an index in
      the constraints setting for a table, you can select "Full-text search" in
      the field selector. This will dramatically speed up search on large tables.
    - Use websearch_to_tsquery if available. This is a more natural and modern syntax.
    - Link to syntax examples in /search
    - Use default locale's language for search localisation.
    - Option to show results in tabs in search configuration.

* select_by_view fieldview for Key fields: the user selects the value of a 
  Key field based on an clicking in a row of rendered views (typically a Show view) of the joined table. Works for both Edit and Filter views.

* Click to edit (Show and List view patterns) is now implemented by rendering
  the first available edit fieldview. This should be more robust and work with 
  more data types.

* Data in the admin's data edit grid is now loaded by page. This makes it
  possible to work with much larger datasets.

* You can now permit to non-admin (role ID > 1) users to edit or inspect tables, or 
  edit views, pages or triggers. In the permissions tab of the Users and security
  settings, minimum roles can be set for these capabilities. The appropriate
  menu items will be added to any users with the roles that match these permissions. 

* Stored calculated fields that contain joinfields in the expression are now automatically 
  updated when the values they reference are changed, i.e. changes occur in the tables they
  reference. This is limited to single (expression contains x.y) and double joinfields 
  (expression contains x.y.z). In most cases, you can now remove all recalculate_stored_fields
  actions.

* Builder: 
    - Add ability to set custom `id` on containers. This is useful for scroll targets
    - Add animations tab to containers. All animations are activated on scroll
    - Tabs and multi-step actions implement a new interface that lets you move, delete and 
      add steps/tabs.

* Workflows:
    - APIResponse step type. Provide the API response
    - Stop step type. Stop workflow immediately
    - EditViewForm step type: run a form from an Edit view, add respnse to context
    - Call other workflows in a workflow step. Control subcontext for called workflow
    - Error handling. SetErrorHandler step type, which set the step invoked on errors
    - ForLoop step type for loops over arrays.
    - Varius UX improvements for editing workflows
    - Integrate copilot, if installed, in workflow editing
    - Call non-workflow trigger actions.

* sbadmin2 theme - Color update: dark side bar, darker primary blue

* AppChange event, runs every time a view, table, trigger, page or configuration value 
  is changed.

* Mobile builder:
    - PJAX view loading: Use pjax for all functions like on the web version.
    - Share content to your app on mobile and PWA. 
      - Ensure at least one ReceiveMobileShareData trigger exists when the app is built or the PWA is installed.
      - Shared content is accessible via the row variable.
      - Android: No additional configuration is needed.
      - PWA: Ensure a trusted HTTPS connection is used.
      - iOS:
        - A second provisioning profile is required, with the bundle ID of the main app followed by share-ext (e.g., com.saltcorn.share-ext).
        - The iOS project needs a Share Extension target. To set this up, open Xcode and add a Share Extension target from a template (more documentation is is about to come).
        - The build will stop when the Xcode integration is required, and a "Finish the Build" shows up.

### Fixes

* Increase plugin install reliability
* fix workflows on SQLite
* fix query string build on check_state_field (#2948). Author: St0rml
* multiple fixes for the Capacitor port

### Translations

* Update Polish translation. Author: skaskiewicz

## 1.1.0 - Released 19 December 2024

* Workflows: a new type of trigger composed of steps, with durable execution and
  a context for sharing information between steps. Workflows can include user interaction
  including asking for user input in specified form fields.

* Workflow rooms: a new view for chatbot-style interactions with workflows

* HTTPS proxy: set an HTTPS proxy with the HTTPS_PROXY environment variable. 

* Edit view: option to allocate new table row when running with a specified row. This is 
  useful when the Edit row includes embedded views based on relations. The allocated row can be
  deleted if there are no changes.

* Acquire Let's Encrypt certificates for tenants. If Let's Encrypt is enabled in the root tenant,
  newly created tenants will acquire a certificate. Certificate for existing tenants can be acquired 
  in that the settings for that tenant in the root tenant's list of tenants.

* Icon plugins. Plugins can now supply additional icons which can be chosen in the builder and
  menu editor

* Registry editor: Edit configuration values

* Webhook action has more options: method, set reponse value, headers.

* Mobile builder:
    - Ported from Cordova to Capacitor: Cordova's core functionalities and plugins are well-maintained, but for some time now, the trend for mobile application development goes new directions. Capacitor aims to be a drop-in replacement with a more modern approach and an active Community. Existing Cordova plugins do still work, and plugins from the Capacitor ecosystem are available as well. This should make the mobile app development more future-proof.
    - Screen orientation change handling: A Saltcorn plugin can register a listener for screen orientation changes (Landscape / Portrait modes). For an example, take a look at the [metronic-theme](https://github.com/saltcorn/metronic-theme/blob/35b69ba7b4e94e2bcfe2f1c61508bc579c1d914f/index.js#L844). It registers a listener to adjust the mobile bottom navigation bar when the phone rotates.
    - PJAX view loading: Changed the full reload to pjax for sortby and gopage (paging). The remainig set_state calls are still full reloads.

### Security

- SameSite cookie settings
- Options to enable Content Security Policy and CORS
- Warn when loading embedded with without role. Strict enforcement in 1.1.2.
- Check table permissions when filling select dropdown options 

### Fixes

* Edit destination formulae are evaluated against the whole row, not only saved form fields
* Set user groups when admin becomes user

### Translations

* Update Polish translation. Author: skaskiewicz

## 1.0.0 - Released 15 November 2024

Change tracking from this point.