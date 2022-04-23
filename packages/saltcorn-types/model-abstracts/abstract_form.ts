import type { Layout } from "../base_types";
import type { AbstractField, AbstractFieldRepeat } from "./abstract_field";

export type AdditionalButton = {
  label: string;
  id: string;
  class: string;
  onclick?: string;
};

export interface AbstractForm {
  fields: Array<AbstractField | AbstractFieldRepeat>;
  errors: any;
  values: any;
  action?: string;
  layout?: Layout;
  id?: string;
  labelCols?: number;
  isStateForm: boolean;
  formStyle: string;
  class?: string;
  methodGET: boolean;
  blurb?: string | string[];
  submitLabel?: string;
  submitButtonClass?: string;
  noSubmitButton?: boolean;
  additionalButtons?: Array<AdditionalButton>;
  onChange?: string;
  xhrSubmit: boolean;
  req: any;
  __?: any;
}
