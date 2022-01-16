/**
 * Role Database Access Layer
 * @category saltcorn-data
 * @module models/form
 * @subcategory models
 */
import {
  AbstractForm,
  AdditionalButton as _AdditionalButton,
} from "@saltcorn/types/model-abstracts/abstract_form";
import {
  instanceOfErrorMsg,
  instanceOfType,
  instanceOfSuccessMsg,
} from "@saltcorn/types/common_types";
import type { FieldLike } from "@saltcorn/types/base_types";
import Field from "./field";
import FieldRepeat from "./fieldrepeat";
import type { Layout } from "@saltcorn/types/base_types";

const { is } = require("contractis");

const isFieldLike = (object: any): object is FieldLike => {
  return object.constructor.name === Object.name;
};

/**
 * Form Class
 * @category saltcorn-data
 */
class Form implements AbstractForm {
  fields: Array<Field | FieldRepeat>;
  errors: any;
  values: any;
  action?: string;
  layout?: Layout;
  id?: string;
  labelCols?: number;
  collapsedSummary?: string;
  isStateForm: boolean;
  formStyle: string;
  class?: string;
  methodGET: boolean;
  blurb?: string | string[];
  submitLabel?: string;
  submitButtonClass?: string;
  noSubmitButton?: boolean;
  additionalButtons?: Array<_AdditionalButton>;
  onChange?: string;
  validator?: (arg0: any) => any;
  hasErrors: boolean;
  xhrSubmit: boolean;
  req: any;
  __?: any;

  /**
   * Constructor
   * @param o
   */
  constructor(o: FormCfg) {
    this.fields = o.fields.map((f: Field | FieldRepeat | FieldLike) => {
      return isFieldLike(f) ? new Field(f) : f;
    });
    this.errors = o.errors || {};
    this.values = o.values || {};
    this.action = o.action;
    this.layout = o.layout;
    this.id = o.id;
    this.labelCols = o.labelCols;
    this.collapsedSummary = o.collapsedSummary;
    this.isStateForm = !!o.isStateForm;
    this.formStyle = o.formStyle || "horiz";
    this.class = o.class;
    this.methodGET = !!o.methodGET;
    this.blurb = o.blurb;
    this.submitLabel = o.submitLabel;
    this.submitButtonClass = o.submitButtonClass;
    this.noSubmitButton = o.noSubmitButton;
    this.additionalButtons = o.additionalButtons;
    this.onChange = o.onChange;
    this.validator = o.validator;
    this.hasErrors = false;
    this.xhrSubmit = !!o.xhrSubmit;
    this.req = o.req;
    this.__ = o.__ || (o.req && o.req.__);
    if (o.validate) this.validate(o.validate);
  }

  /**
   * @param {object} ks
   */
  hidden(...ks: string[]): void {
    ks.forEach((k) => {
      !this.fields.map((f) => f.name).includes(k) &&
        this.fields.push(
          new Field({
            name: k,
            input_type: "hidden",
          })
        );
    });
  }

  /**
   * @param {boolean} [force_allow_none = false]
   */
  async fill_fkey_options(force_allow_none: boolean = false): Promise<void> {
    //console.log(this.values);
    for (const f of this.fields) {
      if (hasFieldMembers(f))
        await f.fill_fkey_options(force_allow_none, undefined, this.values);
    }
  }

  /**
   * @returns {Promise<object>}
   */
  async generate(): Promise<any> {
    var r: any = {};

    for (const f of this.fields) {
      if (hasFieldMembers(f))
        if (f.input_type === "hidden") r[f.name] = this.values[f.name];
        else if (f.name.endsWith("_fml")) r[f.name] = "";
        else if (f.required || is.bool.generate()) {
          r[f.name] = await f.generate();
        }
    }
    return r;
  }

  /**
   * @type {string}
   */
  get errorSummary(): string {
    let strs = new Array<string>();
    Object.entries(this.errors).forEach(([k, v]) => {
      strs.push(`${k}: ${v}`);
    });
    return strs.join("; ");
  }

  /**
   * @param {*} v
   * @returns {object}
   */
  validate(v: any): { success: any } | { errors: any } {
    this.hasErrors = false;
    this.errors = {};
    this.fields.forEach((f) => {
      if (hasFieldMembers(f)) {
        if (f.disabled || f.calculated) return;
        if (
          f.fieldview &&
          f.type &&
          instanceOfType(f.type) &&
          f.type.fieldviews
        ) {
          const fv = f.type.fieldviews[f.fieldview];
          if (fv && !fv.isEdit) return;
        }
      }
      const valres = f.validate(v);
      if (instanceOfErrorMsg(valres)) {
        this.errors[f.name] = valres.error;
        this.values[f.name] = v[f.name];
        this.hasErrors = true;
      } else if (instanceOfSuccessMsg(valres)) {
        if (hasParentField(f) && f.parent_field) {
          if (!this.values[f.parent_field]) this.values[f.parent_field] = {};
          this.values[f.parent_field!][f.name] = valres.success;
        } else {
          this.values[f.name] = valres.success;
        }
      }
    });
    if (Object.keys(this.errors).length > 0) {
      return { errors: this.errors };
    } else {
      if (this.validator) {
        const fvalres = this.validator(this.values);
        if (typeof fvalres === "string") {
          this.hasErrors = true;
          this.errors._form = fvalres;
          return { errors: this.errors };
        }
      }
      return { success: this.values };
    }
  }
}

const hasFieldMembers = (object: any): object is Field => {
  return (
    object &&
    "fill_fkey_options" in object &&
    "input_type" in object &&
    "required" in object &&
    "disabled" in object &&
    "calculated" in object
  );
};

const hasParentField = (object: any): object is Field => {
  return object && "parent_field" in object;
};

namespace Form {
  export type FormCfg = {
    fields: Array<Field | FieldRepeat | FieldLike>;
    errors?: any;
    values?: any;
    action?: string;
    layout?: Layout;
    id?: string;
    labelCols?: number;
    collapsedSummary?: string;
    isStateForm?: boolean;
    formStyle?: string;
    class?: string;
    methodGET?: boolean;
    blurb?: string | string[];
    submitLabel?: string;
    submitButtonClass?: string;
    noSubmitButton?: boolean;
    additionalButtons?: Array<_AdditionalButton>;
    onChange?: string;
    validator?: (arg0: any) => any;
    xhrSubmit?: boolean;
    req?: any;
    validate?: any;
    __?: any;
  };

  export type AdditionalButton = _AdditionalButton;
}
type FormCfg = Form.FormCfg;

export = Form;
