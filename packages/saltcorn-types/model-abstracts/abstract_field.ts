import { GenObj, Type } from "../common_types";
import { AbstractTable } from "./abstract_table";

export interface AbstractField {
  label: string;
  name: string;
  input_type: InputType;
  sourceURL?: string;
  fieldview?: string;
  attributes: any;
  required: boolean;
  primary_key: boolean;
  // 'form_name' is actually a getter
  form_name: string;
}

export type FieldCfg = {
  label?: string;
  name?: string;
  fieldview?: string;
  validator?: (arg0: any) => boolean | string | undefined;
  showIf?: any;
  parent_field?: string;
  postText?: string;
  class?: string;
  id?: number;
  default?: string;
  sublabel?: string;
  description?: string;
  type?: string | Type;
  options?: any;
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
  attributes?: string | GenObj;
  table_id?: number;
  reftype?: string | Type;
  refname?: string;
  table?: AbstractTable | null;
};

export interface AbstractFieldRepeat {
  name: string;
  fields: FieldCfg[]
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
