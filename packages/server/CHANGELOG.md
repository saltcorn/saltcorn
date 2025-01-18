# Notable changes

## 1.1.1 - In beta

* Stored calculated fields that contain joinfields in the expression are now automatically 
  updated when the values they reference are changed, i.e. changes occur in the tables they
  reference. This is limited to single (expression contains x.y) and double joinfields 
  (expression contains x.y.z). In most cases, you can now remove all recalculate_stored_fields
  actions. TODO migration

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

* sbadmin2 theme - Color update: dark side bar, darker primary blue

* AppChange event, runs every time a view, table, trigger, page or configuration value 
  is changed.

* Mobile builder:
    - PJAX view loading.

### Translations

* Update Polish translation. Author: skaskiewicz

### Fixes

* fix query string build on check_state_field (#2948). Author: St0rml
