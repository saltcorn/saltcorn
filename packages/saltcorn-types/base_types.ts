import { AbstractForm } from "./model-abstracts/abstract_form";
import { AbstractTable } from "./model-abstracts/abstract_table";
import { AbstractWorkflow } from "./model-abstracts/abstract_workflow";

import type { Where } from "@saltcorn/db-common/internal";

type FieldLikeBasics = {
  name: string;
};
type FieldLikeWithInputType = {
  input_type?: string;
} & FieldLikeBasics;
type FieldLikeWithType = {
  type?: string | { name: string };
} & FieldLikeBasics;

export type FieldLike =
  | FieldLikeWithInputType
  | FieldLikeWithType
  | (FieldLikeWithInputType & FieldLikeWithType);

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

type LayoutContainerObject = {
  type:
    | "blank"
    | "card"
    | "hero"
    | "pageHeader"
    | "footer"
    | "image"
    | "link"
    | "line_break view";
};
type LayoutContainer = null | LayoutContainerObject | any;
type LayoutTypeHelper = Array<
  | LayoutContainer
  | { besides: Array<LayoutContainer> }
  | { above: Array<LayoutContainer> }
>;
type LayoutWithAbove = { above?: LayoutTypeHelper };
type LayoutWithBesides = { besides: LayoutTypeHelper };
export type Layout =
  | (LayoutWithAbove | LayoutWithBesides)
  | LayoutContainerObject;

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

export type ViewTemplate = {
  name: string;
  get_state_fields?: (
    arg0: number,
    arg1: string,
    arg2: any
  ) => Promise<FieldLike>;
  display_state_form?: boolean | ((arg0: any) => boolean);
  configuration_workflow: (arg0: {
    __: (arg0: string) => string;
  }) => AbstractWorkflow;
  view_quantity?: "Many" | "ZeroOrOne" | "One";
  initial_config?: (arg0: { table_id: number }) => Promise<any>;
  run: ([arg0, arg1, arg2, arg3, arg4]: [
    arg0: number,
    arg1: string,
    arg2: any,
    arg3: any,
    arg4: any
  ]) => Promise<string>;
};

type PluginFunction = {
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
  tables: Array<{
    name: string;
    fields: Array<FieldLike>;
  }>;
  views: Array<{
    name: string;
    viewtemplate: string;
    configuration: any;
  }>;
  plugins: Array<{
    name: string;
    source: string;
    location: string;
  }>;
};

export type Column = {
  type: "Action" | "ViewLink" | "Link" | "JoinField" | "Aggregation" | "Field";
};

export type Tablely = AbstractTable | { external: true };
