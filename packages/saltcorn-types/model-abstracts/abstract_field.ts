export interface AbstractField {
  label: string;
  name: string;
  input_type: string;
  sourceURL?: string;
  attributes: any;
  // 'form_name' is actually a getter
  form_name: string;
}

export interface AbstractFieldRepeat {
  name: string;
}

export const instanceOfField = (object: any): object is AbstractField => {
  return object && "name" in object && "input_type" in object;
};
