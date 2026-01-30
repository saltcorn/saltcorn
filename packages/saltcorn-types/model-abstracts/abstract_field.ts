import { PrimaryKeyValue, Row, Value } from "@saltcorn/db-common/internal";
import type { GenObj, Type } from "../common_types";
import type { AbstractTable } from "./abstract_table";

export interface AbstractField {
  label: string;
  name: string;
  input_type: InputType;
  sourceURL?: string;
  fieldview?: string;
  attributes: any;
  required?: boolean;
  primary_key?: boolean;
  // actually getters:
  form_name?: string;
  type_name?: string | undefined;
  is_fkey: boolean;
  reftable_name?: string;
  pretty_type?: string;
  id?: PrimaryKeyValue;
}

export type FieldCfg = {
  label?: string;
  name?: string;
  fieldview?: string;
  validator?: (
    value: any,
    whole_rec?: Row,
    field?: { required: boolean }
  ) => boolean | string | undefined;
  showIf?: { [field_name: string]: string | boolean | string[] };
  parent_field?: string;
  postText?: string;
  class?: string;
  id?: number;
  default?: string;
  sublabel?: string;
  help?: { topic: string; context?: Row; dynContext?: string[] };
  description?: string;
  type?: string | Type;
  options?: Array<string | { label: string; value: string }>;
  required?: boolean;
  is_unique?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  calculated?: boolean;
  primary_key?: boolean;
  stored?: boolean;
  expression?: string;
  sourceURL?: string;
  input_type?: InputType;
  reftable_name?: string;
  reftable?: AbstractTable;
  attributes?: GenObj;
  table_id?: number;
  reftype?: string | Type;
  refname?: string;
  tab?: string;
  table?: AbstractTable | null;
  in_auto_save?: boolean;
  exclude_from_mobile?: boolean;
};

export interface AbstractFieldRepeat {
  name: string;
  fields: FieldCfg[];
}

export const instanceOfField = (object: any): object is AbstractField => {
  return object && "name" in object && "input_type" in object;
};

export type InputType =
  | "hidden"
  | "file"
  | "select"
  | "fromtype"
  | "search"
  | "text"
  | "password"
  | "section_header"
  | "textarea"
  | "custom_html"
  | "code";
