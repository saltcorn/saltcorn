/**
 * Those are the base types
 * @module
 */
import type { AbstractForm } from "./model-abstracts/abstract_form";
import type {
  AbstractTable,
  TablePack,
} from "./model-abstracts/abstract_table";
import type { AbstractWorkflow } from "./model-abstracts/abstract_workflow";
import type {
  AbstractTrigger,
  TriggerPack,
} from "./model-abstracts/abstract_trigger";
import type { InputType } from "./model-abstracts/abstract_field";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type { Type, ReqRes, GenObj } from "./common_types";
import type { RolePack } from "./model-abstracts/abstract_role";
import type { LibraryPack } from "./model-abstracts/abstract_library";
import type { AbstractView, ViewPack } from "./model-abstracts/abstract_view";
import type { AbstractPage, PagePack } from "./model-abstracts/abstract_page";
import type { PageGroupPack } from "./model-abstracts/abstract_page_group";
import type { PluginPack } from "./model-abstracts/abstract_plugin";
import type { TagPack } from "./model-abstracts/abstract_tag";
import type { ModelPack } from "./model-abstracts/abstract_model";
import type { ModelInstancePack } from "./model-abstracts/abstract_model_instance";
import type { EventLogPack } from "./model-abstracts/abstract_event_log";

type FieldLikeBasics = {
  name: string;
  required?: boolean;
  label?: string;
  fieldview?: string;
  input_type?: InputType;
  type?: string | Type;
  primary_key?: boolean;
};
type FieldLikeWithInputType = {
  input_type: string;
} & FieldLikeBasics;
type FieldLikeWithType = {
  type: string | Type;
} & FieldLikeBasics;
export type FieldLike = FieldLikeWithInputType | FieldLikeWithType;

export type Header = {
  script?: string;
  css?: string;
  headerTag?: string;
};

type MenuItem = {
  label: string;
  link?: string;
  subitems?: Array<{
    label: string;
    link?: string;
  }>;
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
};

type LayoutWithHtmlFile = {
  html_file: string;
  above?: never;
};

type LayoutContainer = null | LayoutWithTypeProp | any;
type LayoutArray = Array<
  | LayoutContainer
  | { besides: Array<LayoutContainer> }
  | { above: Array<LayoutContainer> }
>;
type LayoutWithAbove = { above: LayoutArray; besides?: never };
type LayoutWithBesides = { besides: LayoutArray; above?: never };

export type Layout =
  | LayoutWithAbove
  | LayoutWithBesides
  | LayoutWithTypeProp
  | LayoutWithHtmlFile;

export function instanceOWithHtmlFile(
  object: any
): object is LayoutWithHtmlFile {
  return object && typeof object !== "string" && "html_file" in object;
}

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

export type PluginWrap = (arg0: PluginWrapArg) => string;

export type PluginLayout = {
  wrap: PluginWrap;
  authWrap?: (arg0: PluginAuthwrapArg) => string;
};

type Attribute = {
  name: string;
  type: string;
  required: boolean;
};

export type PluginType = {
  name: string;
  sqlName: string;
  fieldviews: {
    isEdit: boolean;
    run: (
      arg0: any
    ) =>
      | string
      | (([arg0, arg1, arg2, arg3, arg4]: [
          arg0: string,
          arg1: any,
          arg2: any,
          arg3: string,
          arg4: boolean
        ]) => string);
  };
  attributes?: (arg0: any) => Array<Attribute> | Array<Attribute>;
  readFromFormRecord?: ([arg0, arg1]: [arg0: any, arg1: string]) => any;
  readFromDB?: (arg0: any) => any;
  validate?: (arg0: any) => (arg0: any) => boolean;
  presets?: ([]) => any;
};

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

export type RunExtra = {
  redirect?: string;
} & ReqRes &
  SelectOptions;

export type ConnectedObjects = {
  linkedViews?: Array<AbstractView>;
  embeddedViews?: Array<AbstractView>;
  linkedPages?: Array<AbstractPage>;
  tables?: Array<AbstractTable>;
  // trigger are loaded on demand
};

export type ViewTemplate = {
  name: string;
  tableless?: boolean;
  singleton?: boolean;
  get_state_fields?: (
    arg0: number | string,
    arg1: string,
    arg2: any
  ) => Promise<Array<FieldLike>>;
  configuration_workflow?: (arg0: {
    __: (arg0: string) => string;
  }) => AbstractWorkflow;
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
  authorise_post?: (
    opts: {
      body: any;
      table_id: number;
      req: NonNullable<any>;
    },
    queries: any
  ) => Promise<boolean>;
  interpolate_title_string?: (
    table_id: number | string | undefined,
    title: string,
    query: any
  ) => Promise<string>;
  authorise_get?: (
    opts: {
      query: any;
      table_id: number;
      req: NonNullable<any>;
    },
    queries: any
  ) => Promise<boolean>;
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
  routes?: Record<string, Action>;
  virtual_triggers?: (
    table_id: number | undefined,
    name: string,
    configuration: any
  ) => Promise<Array<AbstractTrigger>>;
  queries?: (configuration?: any, req?: any) => Record<string, any>;
  connectedObjects?: (configuration?: any) => Promise<ConnectedObjects>;
};

export type Action = (
  table_id: number | undefined | null,
  viewname: string,
  optsOne: any,
  body: any,
  optsTwo: ReqRes,
  queries: any
) => Promise<any>;

export type PluginFunction = {
  run: (arg0: any) => any;
  returns?: string;
  arguments?: string[];
  isAsync?: boolean;
};

type MaybeCfgFun<Type> = (a: Type) => (arg0: any) => Type | Type | undefined;

export type Plugin = {
  sc_plugin_api_version: number;
  plugin_name?: string;
  headers: MaybeCfgFun<Array<Header>>;
  functions: MaybeCfgFun<PluginFunction | ((arg1: any) => any)>;
  layout: MaybeCfgFun<PluginLayout> | PluginLayout;
  types: MaybeCfgFun<Array<PluginType>>;
  viewtemplates: MaybeCfgFun<Array<ViewTemplate>>;
  configuration_workflow?: ([]) => AbstractWorkflow;
  fieldviews?: {
    type: string;
    isEdit: boolean;
    run:
      | ((arg0: any) => string)
      | (([arg0, arg1, arg2, arg3, arg4]: [
          arg0: string,
          arg1: any,
          arg2: any,
          arg3: string,
          arg4: boolean
        ]) => string);
  };
  dependencies: string[];
  [key: string]: any;
};

export type CodePagePack = {
  name: string;
  code: string;
  tags?: Array<string>;
};

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
  config?: object;
};

export type PluginSourceType = "npm" | "github" | "local" | "git";

export type Column = {
  type: "Action" | "ViewLink" | "Link" | "JoinField" | "Aggregation" | "Field";
};

export type Tablely = AbstractTable | { external: true };

export type MobileConfig = {
  version_tag: string;
  entry_point: string;
  // server_path <=> base_url
  localTableIds: number[];
  synchedTables: string[];
  autoPublicLogin: boolean;
  allowOfflineMode?: boolean;
  allowShareTo?: boolean;
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
  jwt?: string;
  inErrorState?: boolean;
  inLoadState?: boolean;
  encodedSiteLogo?: string;
};

export type JoinFieldOption = {
  name: string;
  table: string;
  fieldPath: string;
  subFields?: Array<JoinFieldOption>;
};

export type RelationOption = {
  relationPath: string;
  relationFields: string[];
};

export type PluginRoute = {
  url: string;
  method?: string;
  csrf?: boolean; // undefined => check csrf
  callback: ({ req, res }: { req: any; res: any }) => void;
};
