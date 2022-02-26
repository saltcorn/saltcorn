import * as fieldImport from "./abstract_field";
import * as formImport from "./abstract_form";
import * as libraryImport from "./abstract_library";
import * as pageImport from "./abstract_page";
import * as pluginImport from "./abstract_plugin";
import * as roleImport from "./abstract_role";
import * as tableImport from "./abstract_table";
import * as triggerImport from "./abstract_trigger";
import * as viewImport from "./abstract_view";
import * as workflowImport from "./abstract_workflow";
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
