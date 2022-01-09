export interface AbstractField {
  label: string;
  name: string;
  input_type: InputType;
  sourceURL?: string;
  attributes: any;
  required: boolean;
  primary_key: boolean;

  // 'form_name' is actually a getter
  form_name: string;
}

export interface AbstractFieldRepeat {
  name: string;
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
