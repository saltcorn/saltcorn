import * as fieldImport from "./abstract_field.js";
import * as formImport from "./abstract_form.js";
import * as libraryImport from "./abstract_library.js";
import * as pageImport from "./abstract_page.js";
import * as pluginImport from "./abstract_plugin.js";
import * as roleImport from "./abstract_role.js";
import * as tableImport from "./abstract_table.js";
import * as triggerImport from "./abstract_trigger.js";
import * as viewImport from "./abstract_view.js";
import * as workflowImport from "./abstract_workflow.js";
/**
 * Those are model-abstracts
 */
export namespace ModelAbstracts {
  export import abstract_field = fieldImport;
  export import abstract_form = formImport;
  export import abstract_library = libraryImport;
  export import abstract_page = pageImport;
  export import abstract_plugin = pluginImport;
  export import abstract_role = roleImport;
  export import abstract_table = tableImport;
  export import abstract_trigger = triggerImport;
  export import abstract_view = viewImport;
  export import abstract_workflow = workflowImport;
}
