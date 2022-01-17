import type { AbstractForm } from "./model-abstracts/abstract_form";
import type {
  AbstractTable,
  TablePack,
} from "./model-abstracts/abstract_table";
import type { AbstractWorkflow } from "./model-abstracts/abstract_workflow";
import type { TriggerPack } from "./model-abstracts/abstract_trigger";
import type { InputType } from "./model-abstracts/abstract_field";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type { Type, ReqRes } from "./common_types";
import type { RolePack } from "./model-abstracts/abstract_role";
import type { LibraryPack } from "./model-abstracts/abstract_library";
import type { ViewPack } from "./model-abstracts/abstract_view";
import type { PagePack } from "./model-abstracts/abstract_page";
import type { PluginPack } from "./model-abstracts/abstract_plugin";

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
    | "card"
    | "hero"
    | "pageHeader"
    | "footer"
    | "image"
    | "link"
    | "line_break view";
  besides?: never;
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

export type Layout = LayoutWithAbove | LayoutWithBesides | LayoutWithTypeProp;

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

export type PluginWrap = (arg0: PluginAuthwrapArg) => string;

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

export type ViewTemplate = {
  name: string;
  get_state_fields?: (
    arg0: number,
    arg1: string,
    arg2: any
  ) => Promise<Array<FieldLike>>;
  display_state_form?: boolean | ((arg0: any) => boolean);
  configuration_workflow: (arg0: {
    __: (arg0: string) => string;
  }) => AbstractWorkflow;
  view_quantity?: "Many" | "ZeroOrOne" | "One";
  initial_config?: (arg0: { table_id: number }) => Promise<any>;
  run: (
    table_id: string | number | undefined,
    viewname: string,
    opts: any,
    state: any,
    arg4: RunExtra
  ) => Promise<string>;
  runMany?: (
    table_id: number,
    viewname: string,
    { columns, layout }: { columns: Array<Column>; layout: Layout },
    state: any,
    extra: RunExtra
  ) => Promise<string[]>;
  renderRows?: (
    table: AbstractTable,
    viewname: string,
    { columns, layout }: { columns: Array<Column>; layout: Layout },
    extra: any,
    rows: Row[]
  ) => Promise<string[]>;
  on_delete?: (
    table_id: number,
    viewname: string,
    configuration: { default_state: any }
  ) => Promise<void>;
  authorise_post?: (opts: {
    body: any;
    table_id: number;
    req: NonNullable<any>;
  }) => Promise<boolean>;
  authorise_get?: (opts: {
    query: any;
    table_id: number;
    req: NonNullable<any>;
  }) => Promise<boolean>;
  runPost?: (
    table_id: number,
    viewname: string,
    optsOne: {
      columns: any[];
      layout: Layout;
      fixed: any;
      view_when_done: any;
      formula_destinations: any;
    },
    state: string,
    body: string,
    extraArgs: RunExtra
  ) => Promise<void>;
  getStringsForI18n?: (configuration?: any) => string[];
  default_state_form?: (arg0: { default_state: any }) => any;
  routes?: Record<string, Action>;
};

export type Action = (
  table_id: number,
  viewname: string,
  optsOne: any,
  body: any,
  optsTwo: ReqRes
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
  headers: MaybeCfgFun<Array<Header>>;
  functions: MaybeCfgFun<PluginFunction | ((arg1: any) => any)>;
  layout: MaybeCfgFun<PluginLayout>;
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
};

export type Pack = {
  tables: Array<TablePack>;
  views: Array<ViewPack>;
  pages: Array<PagePack>;
  plugins: Array<PluginPack>;
  roles: Array<RolePack>;
  library: Array<LibraryPack>;
  triggers: Array<TriggerPack>;
};

export type PluginSourceType = "npm" | "github" | "local" | "git";

export type Column = {
  type: "Action" | "ViewLink" | "Link" | "JoinField" | "Aggregation" | "Field";
};

export type Tablely = AbstractTable | { external: true };
