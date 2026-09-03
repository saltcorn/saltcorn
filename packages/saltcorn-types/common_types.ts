/**
 * @category saltcorn-types
 * @module common_types
 */
import type { FieldView, FieldLike, Req, Res } from "./base_types.js";
import type { AbstractTable } from "./model-abstracts/abstract_table.js";

/** A failed result, e.g. from an action or workflow step. */
export type ErrorMessage = {
  error: string;
  details?: string;
  errors?: string[];
  errorObj?: Error;
};

/** A successful result, e.g. from an action or workflow step. */
export type SuccessMessage = {
  success: any;
  table?: any;
  rows?: any;
  details?: string;
};

/** An Express request/response pair, as passed around the codebase together. */
export type ReqRes = {
  req: Req;
  res?: Res;
};

/** Either an {@link ErrorMessage} or a {@link SuccessMessage}. */
export type ResultMessage = ErrorMessage | SuccessMessage;

/**
 * Type guard for {@link ErrorMessage}.
 * @param object - the value to test
 * @returns true if object is an {@link ErrorMessage}
 */
export const instanceOfErrorMsg = (object: any): object is ErrorMessage => {
  return object && "error" in object;
};

/**
 * Type guard for {@link SuccessMessage}.
 * @param object - the value to test
 * @returns true if object is a {@link SuccessMessage}
 */
export const instanceOfSuccessMsg = (object: any): object is SuccessMessage => {
  return object && "success" in object;
};

/** A field type (e.g. String, Integer, Key) - defines how a field's values are read, validated and displayed. */
export type Type = {
  name: string;
  sql_name?: string | ((attrs: any) => string);
  js_type?: string;
  readFromDB?: (arg0: any, f?: FieldLike) => any;
  read?: (arg0: any, arg1?: any) => any;
  readFromFormRecord?: Function;
  postProcess?: Function;
  validate?: Function;
  listAs?: Function;
  showAs?: Function;
  primaryKey?: { sql_type: string; default_sql?: string };
  presets?: any;
  contract?: any;
  fieldviews?: Record<string, FieldView>;
  attributes?:
    | Array<FieldLike>
    | (({ table }: { table: AbstractTable }) => Promise<Array<FieldLike>>);
  validate_attributes?: Function;
  distance_operators?: { [opName: string]: any };
  discovery_match?: (
    info_schema_col: GenObj
  ) => Promise<Partial<FieldLike> | void>;
  setTypeAttributesForCalculatedFields?:Function
};

/**
 * Type guard for {@link Type}.
 * @param object - the value to test
 * @returns true if object is a {@link Type} (not a bare type-name string)
 */
export function instanceOfType(object: any): object is Type {
  return object && typeof object !== "string";
}

/** A loosely-typed plain object, used where the shape isn't worth declaring precisely. */
export type GenObj = { [key: string]: any };
