# Notable changes

## 1.1.1 - In beta

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

* sbadmin2 theme - Color update: dark side bar, darker primary blue

* AppChange event, runs every time a view, table, trigger, page or configuration value 
  is changed.

* Mobile builder:
    - PJAX view loading.

### Fixes

* fix query string build on check_state_field (#2948). Author: St0rml

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