/**
 * Those are the common types
 * @module
 */
export type ErrorMessage = {
  error: string;
  errors?: string[];
};

export type SuccessMessage = {
  success: any;
  table?: any;
};

export type ReqRes = {
  req: NonNullable<any>;
  res: NonNullable<any>;
};

export type ResultMessage = ErrorMessage | SuccessMessage;

export const instanceOfErrorMsg = (object: any): object is ErrorMessage => {
  return "error" in object;
};

export const instanceOfSuccessMsg = (object: any): object is SuccessMessage => {
  return "success" in object;
};

export type Type = {
  name: string;
  sql_name?: string;
  readFromDB?: (arg0: any) => any;
  read?: (arg0: any, arg1?: any) => any;
  readFromFormRecord?: Function;
  validate?: Function;
  listAs?: Function;
  showAs?: Function;
  primaryKey?: { sql_type: string; default_sql?: string };
  presets?: any;
  contract?: any;
  fieldviews?: any;
  attributes?: GenObj;
  validate_attributes?: Function;
};

export function instanceOfType(object: any): object is Type {
  return object && typeof object !== "string";
}

export type GenObj = { [key: string]: any };
