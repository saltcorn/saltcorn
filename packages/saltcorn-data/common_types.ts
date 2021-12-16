export type ErrorMessage = {
  error: string;
};

export type SuccessMessage = {
  success: string | boolean | null;
  table?: any;
};

export type ResultMessage = ErrorMessage | SuccessMessage;

export const instanceOfErrorMsg = (object: any): object is ErrorMessage => {
  return "error" in object;
};

export const instanceOfSuccessMsg = (object: any): object is SuccessMessage => {
  return "success" in object;
};

export type TypeObj = {
  name: string;
  sql_name?: string;
  readFromDB?: (arg0: any) => any;
  read?: (arg0: any, arg1?: any) => any;
  readFromFormRecord?: Function;
  validate?: Function;
  listAs?: Function;
  showAs?: Function;
  primaryKey: { sql_type: string; default_sql?: string };
  presets?: any;
  contract?: any;
};

export function instanceOfTypeObj(object: any): object is TypeObj {
  return object && typeof object !== "string";
}
