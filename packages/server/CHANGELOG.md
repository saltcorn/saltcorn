# Notable changes

## 1.1.3 - In beta

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