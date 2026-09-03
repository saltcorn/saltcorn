/**
 * Base types shared across Saltcorn packages: plugin, view, layout, and
 * request/response shapes.
 * @category saltcorn-types
 * @module base_types
 */
import type { AbstractForm } from "./model-abstracts/abstract_form.js";
import {
  AbstractTable,
  TablePack,
  instanceOfTable,
} from "./model-abstracts/abstract_table.js";
import type { AbstractWorkflow } from "./model-abstracts/abstract_workflow.js";
import type {
  AbstractTrigger,
  TriggerPack,
} from "./model-abstracts/abstract_trigger.js";
import type { InputType } from "./model-abstracts/abstract_field.js";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type { Type, ReqRes, GenObj } from "./common_types.js";
import type { RolePack } from "./model-abstracts/abstract_role.js";
import type { LibraryPack } from "./model-abstracts/abstract_library.js";
import {
  AbstractView,
  ViewPack,
  instanceOfView,
} from "./model-abstracts/abstract_view.js";
import type {
  AbstractPage,
  PagePack,
} from "./model-abstracts/abstract_page.js";
import type { PageGroupPack } from "./model-abstracts/abstract_page_group.js";
import {
  PluginPack,
  instanceOfPlugin,
} from "./model-abstracts/abstract_plugin.js";
import type { TagPack } from "./model-abstracts/abstract_tag.js";
import type { ModelPack } from "./model-abstracts/abstract_model.js";
import type { ModelInstancePack } from "./model-abstracts/abstract_model_instance.js";
import type { EventLogPack } from "./model-abstracts/abstract_event_log.js";
import type { AbstractUser } from "./model-abstracts/abstract_user.js";

type FieldLikeBasics = {
  name: string;
  required?: boolean;
  label?: string;
  fieldview?: string;
  input_type?: InputType;
  type?: string | Type;
  class?: string | string[];
  primary_key?: boolean;
  sublabel?: string;
  validator?: (arg0: any) => boolean | string | undefined;
  attributes?: GenObj;
  showIf?: { [field_name: string]: string | boolean | string[] };
  isRepeat?: boolean;
  tstype?: string;
};
type FieldLikeWithSelectInputType = {
  input_type: "select";
  options: Array<string | { label: string; value: string }>;
} & FieldLikeBasics;
type FieldLikeWithInputType = {
  input_type: InputType;
} & FieldLikeBasics;
type FieldLikeWithType = {
  type: string | Type;
} & FieldLikeBasics;
/** A field definition as accepted by form-building APIs (Form fields, action configFields, etc). */
export type FieldLike =
  | FieldLikeWithSelectInputType
  | FieldLikeWithInputType
  | FieldLikeWithType;

/** Extra `<head>` content (script/css) a plugin or view can register. */
export type Header = {
  script?: string;
  css?: string;
  style?: string;
  headerTag?: string;
  onlyViews?: string[];
  onlyFieldviews?: string[];
  only_if?: (req: Req) => boolean | undefined;
  defer?: boolean;
};

/** One entry in the top navigation menu. */
export type MenuItem = {
  href: string;
  icon: string;
  text: string;
  type: string;
  label: string;
  link?: string;
  style: string;
  title: string;
  target: string;
  tooltip: string;
  in_modal?: boolean;
  location: string;
  shortcut?: string;
  max_role: string;
  min_role: number | string;
  admin_page?: string;
  user_page?: string;
  target_blank?: boolean;
  disable_on_mobile: boolean;
  subitems?: MenuItem[];
  user_menu_header?: boolean;
};

type LayoutWithTypeProp = {
  type:
    | "blank"
    | "breadcrumbs"
    | "view"
    | "page"
    | "table"
    | "dropdown_menu"
    | "tabs"
    | "line_break"
    | "search_bar"
    | "card"
    | "hero"
    | "pageHeader"
    | "footer"
    | "image"
    | "link"
    | "container"
    | "line_break view";
  besides?: never;
  above?: never;
  contents?: Layout | string | Array<Layout | string>;
  [key: string]: any;
};

type LayoutWithHtmlFile = {
  html_file: string;
  html_string?: never;
  above?: never;
};

type LayoutWithHtmlString = {
  html_string: string;
  html_file?: never;
  above?: never;
};

type LayoutContainer = null | LayoutWithTypeProp | any;
type LayoutArray = Array<
  | LayoutContainer
  | { besides: Array<LayoutContainer>; widths?: number[] }
  | { above: Array<LayoutContainer> }
>;
type LayoutWithAbove = { above: LayoutArray; besides?: never };
type LayoutWithBesides = {
  besides: LayoutArray;
  widths?: number[];
  breakpoint?: "md" | "sm" | "lg";
  above?: never;
};

/** A view/page layout tree, as built by the AppConstructor page builder. */
export type Layout =
  | LayoutWithAbove
  | LayoutWithBesides
  | LayoutWithTypeProp
  | LayoutWithHtmlFile
  | LayoutWithHtmlString;

/**
 * Type guard for a layout node using html_file.
 * @param object - the value to test
 * @returns true if object is a layout node with an html_file property
 */
export function instanceOWithHtmlFile(
  object: any
): object is LayoutWithHtmlFile {
  return object && typeof object !== "string" && "html_file" in object;
}

/** Result of loading one plugin module. */
export type PluginLoaderResult = {
  version?: string;
  location: string;
  name: string;
  loadedWithReload?: boolean;
  msgs: string[];
  plugin_module: Plugin;
};

/** Arguments passed to a theme's page-wrap function. */
export type PluginWrapArg = {
  title: string;
  body: string | Layout;
  currentUrl: string;
  brand: { name: string };
  menu: Array<{
    section: string;
    items: Array<MenuItem>;
  }>;
  alerts: Array<{
    type: "error" | "danger" | "success" | "warning";
    msg: string | string[];
  }>;
  headers: Array<Header>;
  bodyClass: string;
  role?: number;
};

type PluginAuthwrapArg = {
  title: string;
  form: AbstractForm;
  afterForm?: string;
  brand: { name: string; logo?: string };
  menu: Array<{
    section: string;
    items: Array<MenuItem>;
  }>;
  alerts: Array<{
    type: "error" | "danger" | "success" | "warning";
    msg: string | Array<string>;
  }>;
  headers: Array<Header>;
  authLinks: {
    login?: string;
    signup?: string;
    forgot?: string;
  };
};

/** A theme's function that wraps page body content in the site chrome. */
export type PluginWrap = (arg0: PluginWrapArg) => string;

/** A theme plugin's layout facility: wrap/authWrap/renderBody. */
export type PluginLayout = {
  wrap: PluginWrap;
  authWrap?: (arg0: PluginAuthwrapArg) => string;
  renderBody?: (arg: any) => string;
  pluginName?: string;
};

type Attribute = {
  name: string;
  type: string;
  required: boolean;
};

type ReadFromFormRecord = {
  ([arg0, arg1]: [any, string]): any;
  (arg0: any, arg1: any): any;
};

/** A custom field type registered by a plugin. */
export type PluginType = {
  name: string;
  sqlName: string;
  fieldviews: Record<string, FieldView>;
  attributes?: (arg0: any) => Array<Attribute> | Array<Attribute>;
  validate_attributes: any;
  readFromFormRecord?: ReadFromFormRecord;
  readFromDB?: (arg0: any, f?: FieldLike) => any;
  validate?: (arg0: any) => (arg0: any) => boolean;
  presets?: ([]) => any;
  read: any;
  contract?: any;
};

/** Query options (joins, aggregations, filtering, paging) for reading table rows. */
export type TableQuery = {
  joinFields?: { ref: string; target: string };
  aggregations?: {
    ref: string;
    table: string;
    field: string;
    aggregate: string;
  };
  where?: Where;
  limit?: number;
  offset?: number;
  orderBy?: string | any;
  orderDesc?: boolean;
};

/** Extra options passed into a ViewTemplate's run/runMany/renderRows. */
export type RunExtra = {
  redirect?: string;
  onRowSelect?: Function;
  removeIdFromstate?: boolean;
} & ReqRes &
  SelectOptions;

/** Views, pages, and tables referenced by a view/page's configuration. */
export type ConnectedObjects = {
  linkedViews?: Array<AbstractView>;
  embeddedViews?: Array<AbstractView>;
  linkedPages?: Array<AbstractPage>;
  tables?: Array<AbstractTable>;
  // trigger are loaded on demand
};

type ActionMode = "edit" | "show" | "filter" | "list" | "workflow" | "page";

/** A plugin action, runnable from triggers, list actions, or workflow steps. */
export type Action = {
  namespace?: string;
  description?: string;
  run: ({
    row,
    user,
    configuration,
    mode,
    table,
  }: {
    table?: AbstractTable;
    row?: Row;
    configuration?: Row;
    user?: AbstractUser;
    mode?: ActionMode;
    trigger_id?: number;
  }) => Promise<any>;
  configFields?:
    | Array<FieldLike>
    | ((...args: any[]) => Promise<Array<FieldLike>> | Array<FieldLike>);
  disableInBuilder?: boolean;
  disableInList?: boolean;
  disableInWorkflow?: boolean;
  requireRow?: boolean;
  deprecated?: boolean;
  disableIf?: () => boolean;
  configFormOptions?: GenObj;
};

/** A view type (List, Show, Edit, etc): defines how a view's configuration is built and rendered. */
export type ViewTemplate = {
  name: string;
  description?: string;
  // Used when the app constructor generates a task
  copilot_planning_rule?: string | ((input: any) => Promise<string> | string);
  // Used when the app constructor executes a task where a view gets generated
  copilot_layout_rule?: string | ((input: any) => Promise<string> | string);
  // Used when the app constructor fills out the fields of a view config form
  copilot_generate_view_prompt?:
    | string
    | ((input: any) => Promise<string> | string);
  tableless?: boolean;
  table_optional?: boolean;
  singleton?: boolean;
  deprecated?: boolean;
  mobile_render_server_side?: boolean;
  get_state_fields?: (
    table_id: number | string | undefined,
    viewname: string,
    configuration: any
  ) => Promise<Array<FieldLike>> | Array<FieldLike>;
  configuration_workflow?: (req: Req) => AbstractWorkflow;
  view_quantity?: "Many" | "ZeroOrOne" | "One";
  initial_config?: (arg0: { table_id: number }) => Promise<any>;
  configCheck?: (
    cfg: any
  ) => Promise<string[] | { errors: string[]; warnings: string[] }>;
  run: (
    table_id: string | number | undefined,
    viewname: string,
    opts: any,
    state: any,
    arg4: RunExtra,
    queries: any
  ) => Promise<string>;
  runMany?: (
    table_id: number,
    viewname: string,
    { columns, layout }: { columns: Array<Column>; layout: Layout },
    state: any,
    extra: RunExtra,
    queries: any
  ) => Promise<string[]>;
  renderRows?: (
    table: AbstractTable,
    viewname: string,
    { columns, layout }: { columns: Array<Column>; layout: Layout },
    extra: any,
    rows: Row[],
    state: any
  ) => Promise<string[]>;
  on_delete?: (
    table_id: number,
    viewname: string,
    configuration: { default_state: any }
  ) => Promise<void>;
  interpolate_title_string?: (
    table_id: number | string | undefined,
    title: string,
    query: any
  ) => Promise<string>;
  runPost?: (
    table_id: number | number | undefined,
    viewname: string,
    optsOne: {
      columns: any[];
      layout: Layout;
      fixed: any;
      view_when_done: any;
      formula_destinations: any;
    },
    state: GenObj,
    body: GenObj,
    extraArgs: RunExtra,
    queries: any,
    remote?: boolean
  ) => Promise<void>;

  openDataStream?: (
    table_id: number | undefined,
    viewName: string,
    id: number | undefined,
    fieldName: string,
    fieldView: string,
    user: any,
    configuration: any,
    targetOpts: any
  ) => Promise<any>;

  getStringsForI18n?: (configuration?: any) => string[];
  default_state_form?: (arg0: { default_state: any }) => any;
  routes?: Record<string, RouteAction>;
  virtual_triggers?: (
    table_id: number | undefined,
    name: string,
    configuration: any
  ) => Promise<Array<AbstractTrigger>>;
  queries?: (configuration?: any, req?: any) => Record<string, any>;
  connectedObjects?: (configuration?: any) => Promise<ConnectedObjects>;
  noAutoTest?: boolean;
  createBasicView?: Function;
};

/** A handler for one of a ViewTemplate's custom routes. */
export type RouteAction = (
  table_id: number | undefined | null,
  viewname: string,
  optsOne: any,
  body: any,
  optsTwo: ReqRes,
  queries: any
) => Promise<any>;

/** A custom formula/expression function registered by a plugin. */
export type PluginFunction = {
  run: (...arg0: any[]) => any;
  returns?: string;
  arguments?: string[] | FieldLike[];
  isAsync?: boolean;
  hidden?: boolean;
};

/** A read-only fieldview: renders a field's value as HTML. */
export type FieldViewShow = {
  isEdit?: false;
  isFilter?: false;
  run: (value: any, req: Req, attrs: GenObj) => string;
};
/** An editable fieldview: renders a field's value as a form input. */
export type FieldViewEdit = {
  isEdit: true;
  isFilter?: false;
  run: (
    name: string,
    value: any,
    attrs: GenObj,
    cls?: string,
    required?: boolean,
    field?: FieldLike
  ) => string;
};

/** A filter fieldview: renders a field's value as a search/filter input. */
export type FieldViewFilter = {
  isEdit?: boolean;
  isFilter: true;
  run: (
    name: string,
    value: any,
    attrs: GenObj,
    cls: string,
    required: boolean,
    field: FieldLike,
    state: GenObj
  ) => string;
};

/** A fieldview: one way of displaying or editing a field's value. */
export type FieldView = {
  readFromFormRecord?: Function;
  read?: Function;
  type?: string;
  deprecated?: boolean;
  blockDisplay?: boolean;
  handlesTextStyle?: boolean;
  description?: string;
  fill_options_restrict?: (field: FieldLike, value: any) => Where | undefined;
  fill_options?: (
    field: FieldLike,
    force_allow_none: boolean,
    where: Where | undefined,
    extraCtx: GenObj,
    optionsQuery?: any,
    formFieldNames?: string[],
    user?: AbstractUser
  ) => Promise<void>;
  configFields?:
    | Array<FieldLike>
    | ((...args: any[]) => Promise<Array<FieldLike>> | Array<FieldLike>);
} & (FieldViewShow | FieldViewEdit | FieldViewFilter);

/**
 * Type guard for {@link FieldViewEdit}.
 * @param object - the value to test
 * @returns true if object is a {@link FieldViewEdit}
 */
export function instanceOfFieldViewEdit(object: any): object is FieldViewEdit {
  return object && typeof object !== "string" && object.isEdit === true;
}

/**
 * Type guard for {@link FieldViewShow}.
 * @param object - the value to test
 * @returns true if object is a {@link FieldViewShow}
 */
export function instanceOfFieldViewShow(object: any): object is FieldViewShow {
  return object && typeof object !== "string" && object.isEdit === false;
}

type CfgFun<T> = { [P in keyof T]: (cfg: GenObj) => T[P] };

declare function flash(
  flash_type: "warning" | "success" | "error" | "danger",
  message: string
): void;
declare function flash(
  flash_type: "warning" | "success" | "error" | "danger"
): string;

/** An Express request, extended with Saltcorn's user/locale/flash helpers. */
export type Req = {
  query: GenObj;
  flash: typeof flash;
  user?: AbstractUser;
  csrfToken: () => string;
  getLocale: () => string;
  isAuthenticated: () => boolean;
  headers: GenObj;
  xhr: boolean;
  __: (s: string, ...args: any[]) => string;
  get: (s: string) => string;
  body: any;
  sessionID?: string;
  protocol?: string;
  hostname?: string;
  [k: string]: any;
};
/** An Express response, extended with Saltcorn's sendWrap helper. */
export type Res = {
  redirect: (url: string) => void;
  send: (contents: string | Buffer) => void;
  sendWrap: (...contents: any[]) => void;
  json: (value: unknown) => void;
  status: (http_code: number) => Res;
  [k: string]: any;
};

/** A machine-learning model pattern (algorithm), e.g. linear regression. */
export type ModelPattern = {
  configuration_workflow: (req: Req) => AbstractWorkflow;
  prediction_outputs: ({
    configuration,
  }: {
    configuration: GenObj;
  }) => Array<FieldLike>;
  hyperparameter_fields: ({
    configuration,
    table,
  }: {
    configuration: GenObj;
    table: AbstractTable;
  }) => Array<FieldLike>;
  train: ({
    table,
    configuration,
    hyperparameters,
    state,
  }: {
    table: AbstractTable;
    configuration: GenObj;
    hyperparameters: GenObj;
    state: GenObj;
  }) => Promise<any>;
  predict: ({
    id,
    model,
    hyperparameters,
    fit_object,
    rows,
  }: {
    id: number;
    model: { configuration: GenObj };
    hyperparameters: GenObj;
    fit_object: any;
    rows: Array<Row>;
  }) => Promise<Array<GenObj>>;
};

/** A login strategy (e.g. Google, GitHub) registered by an auth plugin. */
export type AuthenticationMethod = {
  icon?: string;
  label: string;
  parameters?: GenObj;
  strategy: any;
};
/** An external data source pluggable in as a virtual table. */
export type TableProvider = {
  configuration_workflow: (req?: Req) => AbstractWorkflow;
  fields: (cfg: GenObj) => Promise<Array<FieldLike>>;
  get_table: (cfg: GenObj) => Partial<AbstractTable>;
};

/** A tool the AI app-building assistant (copilot) can call. */
export type CopilotSkill = {
  title: string;
  function_name: string;
  description: string;
  json_schema: () => Promise<GenObj>;
  system_prompt: () => Promise<string>;
  render_html: (config: GenObj) => Promise<string>;
  execute: (config: GenObj) => Promise<{ postExec?: string } | void>;
};

/** A native Capacitor plugin bundled into the mobile app build. */
export type CapacitorPlugin = {
  name: string;
  version: string;
  androidPermissions?: string[];
  androidFeatures?: string[];
};

/** The kind of entity an authorize_* hook is evaluating access to. */
export type AuthorizeAccessKind = "view" | "page" | "trigger" | "api";

/** Common fields of an access-authorization request. */
export type AuthorizeAccessRequestBase = {
  action: "get" | "post";
  route?: string; // specific route/action invoked, e.g. a ViewTemplate.routes key
  state?: GenObj; // query/state, for action "get"
  body?: GenObj; // POST body, for action "post"
  req: Req;
};

/** An access-authorization request for a view. */
export type AuthorizeAccessViewRequest = AuthorizeAccessRequestBase & {
  view: AbstractView; // carries name and table_id
};
/** An access-authorization request for a page. */
export type AuthorizeAccessPageRequest = AuthorizeAccessRequestBase & {
  page: AbstractPage; // carries name
};
/** An access-authorization request for a trigger. */
export type AuthorizeAccessTriggerRequest = AuthorizeAccessRequestBase & {
  trigger: AbstractTrigger; // carries name and table_id
};
/** An access-authorization request for a plugin API route (no entity to name it, so route is required). */
export type AuthorizeAccessApiRequest = Omit<
  AuthorizeAccessRequestBase,
  "route"
> & {
  route: string;
};

/** The outcome of an authorize_* hook: allow, or deny with an optional reason. */
export type AuthorizeAccessResult =
  | { decision: "allow" }
  | { decision: "deny"; reason?: string };

// Return null/undefined to abstain (no opinion); { decision: "deny" } is an
// active decision, whose reason is kept for diagnostics.
type AuthorizeAccessHookReturn =
  | Promise<AuthorizeAccessResult | null | undefined>
  | AuthorizeAccessResult
  | null
  | undefined;

/** A plugin hook that can allow/deny access to a view. */
export type AuthorizeAccessViewHook = (
  request: AuthorizeAccessViewRequest,
  user: any
) => AuthorizeAccessHookReturn;
/** A plugin hook that can allow/deny access to a page. */
export type AuthorizeAccessPageHook = (
  request: AuthorizeAccessPageRequest,
  user: any
) => AuthorizeAccessHookReturn;
/** A plugin hook that can allow/deny access to a trigger. */
export type AuthorizeAccessTriggerHook = (
  request: AuthorizeAccessTriggerRequest,
  user: any
) => AuthorizeAccessHookReturn;
/** A plugin hook that can allow/deny access to a plugin API route. */
export type AuthorizeAccessApiHook = (
  request: AuthorizeAccessApiRequest,
  user: any
) => AuthorizeAccessHookReturn;

type PluginFacilities = {
  headers?: Array<Header>;
  functions?: Record<string, PluginFunction | Function> | Function;
  layout?: PluginLayout;
  types?: Array<Type>;
  viewtemplates?:
    | Array<ViewTemplate>
    | ((cfg: any) => Array<ViewTemplate>)
    | Record<string, ViewTemplate>;
  actions?: Record<string, Action>;
  eventTypes?: Record<string, { hasChannel: boolean }>;
  fieldviews?: Record<string, GenObj>;
  routes?: Array<{
    url: string;
    method: "get" | "post";
    callback: (req: Req, res: Res) => Promise<void>;
  }>;
  modelpatterns?: Record<string, ModelPattern>;
  authentication?: Record<string, AuthenticationMethod>;
  table_providers?: Record<string, TableProvider>;
  copilot_skills?: Array<CopilotSkill>;
  icons?: Array<string>;
  exchange?: Record<string, Array<unknown>>;
  authorize_view?: AuthorizeAccessViewHook;
  authorize_page?: AuthorizeAccessPageHook;
  authorize_trigger?: AuthorizeAccessTriggerHook;
  authorize_api?: AuthorizeAccessApiHook;
};

type PluginWithConfig = {
  configuration_workflow: (req?: Req) => AbstractWorkflow;
} & CfgFun<PluginFacilities>;

type PluginWithoutConfig = {
  configuration_workflow?: undefined;
} & PluginFacilities;

type PluginBase = {
  sc_plugin_api_version: number;
  plugin_name?: string;
  dependencies?: string[];
  onLoad?: (cfg: any) => Promise<void>;
  [key: string]: any;
};

/** A Saltcorn plugin module: the facilities (types, actions, viewtemplates, ...) it registers. */
export type Plugin = PluginBase &
  PluginFacilities & {
    configuration_workflow?: (req?: Req) => AbstractWorkflow;
  };

// export type Plugin = {
//   sc_plugin_api_version: number;
//   plugin_name?: string;
//   dependencies: string[];
//   onLoad?: (cfg: any) => Promise<void>;
//   [key: string]: any;
// } & (PluginWithConfig | PluginWithoutConfig);

/** A portable (import/export) representation of a code page. */
export type CodePagePack = {
  name: string;
  code: string;
  tags?: Array<string>;
};

/** A full export bundle: every entity type a Saltcorn app/pack can contain. */
export type Pack = {
  tables: Array<TablePack>;
  views: Array<ViewPack>;
  pages: Array<PagePack>;
  page_groups: Array<PageGroupPack>;
  plugins: Array<PluginPack>;
  roles: Array<RolePack>;
  library: Array<LibraryPack>;
  triggers: Array<TriggerPack>;
  tags: Array<TagPack>;
  models: Array<ModelPack>;
  model_instances: Array<ModelInstancePack>;
  event_logs?: Array<EventLogPack>;
  code_pages?: Array<CodePagePack>;
  config?: Record<string, any>;
};

/**
 * Type guard for {@link Pack}.
 * @param object - the value to test
 * @returns true if object is a {@link Pack}
 */
export const instanceOfPack = (object: any): object is Pack => {
  return (
    object &&
    "tables" in object &&
    Array.isArray(object.tables) &&
    object.tables.every((t: any) => instanceOfTable(t)) &&
    "views" in object &&
    Array.isArray(object.views) &&
    object.views.every((v: any) => instanceOfView(v)) &&
    "plugins" in object &&
    Array.isArray(object.plugins) &&
    object.plugins.every((p: any) => instanceOfPlugin(p))
  );
};

/** Where a plugin's code is installed from. */
export type PluginSourceType = "npm" | "github" | "local" | "git";

/** One column of a List/Show view, or a page's table view. */
export type Column = {
  type:
    | "Action"
    | "ViewLink"
    | "Link"
    | "JoinField"
    | "Aggregation"
    | "Field"
    | "FormulaValue";
  // Field type properties
  field_name?: string;
  fieldview?: string;
  // Action type properties
  action_label_formula?: boolean;
  action_label?: string;
  action_name?: string;
  // ViewLink type properties
  view_label_formula?: boolean;
  view_label?: string;
  extra_state_fml?: string;
  view?: string;
  // JoinField type properties
  join_field?: string;
  // Link type properties
  link_text_formula?: boolean;
  link_text?: string;
  link_url_formula?: boolean;
  link_url?: string;
  // Common properties
  [key: string]: any;
};

/** An AbstractTable, or a marker for a table living outside this Saltcorn instance. */
export type Tablely = AbstractTable | { external: true };

/** Runtime configuration for a built mobile app. */
export type MobileConfig = {
  version_tag: string;
  entry_point: string;
  entryPointType: "view" | "page" | "byrole";
  server_path?: string; // <=> base_url

  synchedTables: string[];
  autoPublicLogin: boolean;
  showContinueAsPublicUser?: boolean;
  allowOfflineMode?: boolean;
  syncOnReconnect?: boolean;
  syncOnAppResume?: boolean;
  pushSync?: boolean;
  syncInterval?: number;
  pushSyncHeartbeatInterval?: number;
  allowShareTo?: boolean;
  apnsEnvironment?: "development" | "production";
  isOfflineMode?: boolean;
  networkState?:
    | "cellular"
    | "2g"
    | "3g"
    | "4g"
    | "ethernet"
    | "none"
    | "unknown"
    | "wifi";
  pluginHeaders?: string[];

  user?: any;
  isPublicUser?: boolean;
  hasSession?: boolean;
  csrfToken?: string;
  // Only set by Node-based tests: fetch has no cookie jar outside a browser,
  // so the session cookie has to be tracked and attached by hand.
  cookie?: string;
  inErrorState?: boolean;
  inLoadState?: boolean;
  encodedSiteLogo?: string;

  pushConfiguration?: {
    token: string;
    deviceId: string;
  };
};

/** A join-field selectable in the view/page builder's field picker. */
export type JoinFieldOption = {
  name: string;
  table: string;
  fieldPath: string;
  subFields?: Array<JoinFieldOption>;
};

/** A one-to-many/many-to-many relation path selectable in the builder. */
export type RelationOption = {
  relationPath: string;
  relationFields: string[];
};

/** A custom HTTP route registered by a plugin. */
export type PluginRoute = {
  url: string;
  method?: string;
  noCsrf?: boolean;
  callback: ({ req, res }: { req: Req; res: Res }) => void;
};

/** The result of running a trigger/workflow action. */
export type ResultType = {
  set_fields?: GenObj;
  halt_steps?: boolean;
  notify?: string;
  notify_success?: string;
  error?: string;
  goto?: string;
  [key: string]: any;
};

/** The result of running one step of a multi-step workflow. */
export type StepResType = ResultType & {
  goto_step?: number;
  clear_return_values?: boolean;
};

/** Configuration for generating a URL slug field. */
export type SlugStepType = {
  field: string;
  unique: boolean;
  transform: string | null;
};

/** Database/server connection configuration (as in .env / config table). */
export type ConnectObjType = {
  connectionString?: string;
  sqlite_path?: string;
  db_driver?: string;
  password?: string;
  user?: string;
  database?: string;
  host?: string;
  port?: string | number;
  session_secret?: string;
  sslmode?: string;
  sslcert?: string;
  sslkey?: string;
  sslrootcert?: string;
  jwt_secret?: string;
  multi_tenant?: boolean;
  file_store?: string;
  default_schema?: string;
  fixed_configuration?: any;
  exposed_configuration?: any;
  inherit_configuration?: any;
  version_tag?: string;
};

/** A calculated join-field's target path, for stored calculated fields. */
export type CalcJoinfield = {
  targetTable: string;
  field: string;
  targetField: string;
  through?: any[];
  throughTable?: any[];
};

/** A serialized JavaScript Error. */
export type ErrorObj = {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  [key: string]: any;
};

/** A nested field within a JSON/composite field's schema. */
export type SubField = {
  name: string;
  table?: string;
  subFields: any[];
  fieldPath: string;
};
