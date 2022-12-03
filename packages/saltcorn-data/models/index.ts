// For the typedoc documentation

import Crash from "./crash";
import EventLog from "./eventlog";
import Field from "./field";
import FieldRepeat from "./fieldrepeat";
import File from "./file";
import Form from "./form";
import Library from "./library";
import Page from "./page";
import Plugin from "./plugin";
import Role from "./role";
import TableConstraint from "./table_constraints";
import Table from "./table";
import Trigger from "./trigger";
import User from "./user";
import View from "./view";
import Workflow from "./workflow";

export {
  Crash,
  EventLog,
  Field,
  FieldRepeat,
  File,
  Form,
  Library,
  Page,
  Plugin,
  Role,
  TableConstraint,
  Table,
  Trigger,
  User,
  View,
  Workflow,
};

import configImport from "./config";
export namespace config {
  export const {
    getConfig,
    getAllConfig,
    setConfig,
    getAllConfigOrDefaults,
    deleteConfig,
    configTypes,
    remove_from_menu,
    available_languages,
    isFixedConfig,
    get_latest_npm_version,
    get_base_url,
    save_menu_items,
    check_email_mask,
  } = configImport;
}

import discoveryImport from "./discovery";
export namespace discovery {
  export const {
    discoverable_tables,
    discover_tables,
    implement_discovery,
    get_existing_views,
  } = discoveryImport;
}

import emailImport from "./email";
export namespace email {
  export const { getMailTransport, viewToEmailHtml, send_verification_email } =
    emailImport;
}

import expressionImport from "./expression";
export namespace expression {
  export const {
    expressionValidator,
    apply_calculated_fields,
    get_async_expression_function,
    get_expression_function,
    eval_expression,
    recalculate_for_stored,
    transform_for_async,
    apply_calculated_fields_stored,
    jsexprToWhere,
  } = expressionImport;
}

import layoutImport from "./layout";
export namespace layout {
  export const {
    eachView,
    getViews,
    traverse,
    traverseSync,
    getStringsForI18n,
    translateLayout,
  } = layoutImport;
}

import randomImport from "./random";
export namespace random {
  export const { random_table, fill_table_row, initial_view, all_views } =
    randomImport;
}

import schedulerImport from "./scheduler";
export namespace scheduler {
  export const runScheduler = schedulerImport;
}
