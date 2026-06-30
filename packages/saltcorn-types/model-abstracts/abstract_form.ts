import type { Layout, Req } from "../base_types.js";
import type { AbstractField, AbstractFieldRepeat } from "./abstract_field.js";

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
  viewname?: string;
  layout?: Layout;
  id?: string;
  labelCols?: number;
  formStyle: string;
  class?: string;
  methodGET: boolean;
  blurb?: string | string[];
  submitLabel?: string;
  submitButtonClass?: string;
  noSubmitButton?: boolean;
  noLabelCols?: boolean;
  additionalButtons?: Array<AdditionalButton>;
  onChange?: string;
  xhrSubmit: boolean;
  splitPaste?: boolean;
  isOwner?: boolean;
  onSubmit?: string;
  tabs?: any;
  req?: Req;
  __?: (s: string, ...args: any[]) => string;
  isWorkflow?: boolean;
  pk_name?: string;
}
