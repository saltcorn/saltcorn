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
  Type,
} from "@saltcorn/types/common_types";
import type { GenObj } from "@saltcorn/types/common_types";
import Field from "./field";
import User from "./user";
import FieldRepeat from "./fieldrepeat";
import type { FieldLike, Layout, Header } from "@saltcorn/types/base_types";

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
  values: GenObj;
  action?: string;
  viewname?: string;
  layout?: Layout;
  id?: string;
  labelCols?: number;
  collapsedSummary?: string;
  formStyle: string;
  class?: string;
  methodGET: boolean;
  blurb?: string | string[];
  submitLabel?: string;
  submitButtonClass?: string;
  noSubmitButton?: boolean;
  additionalButtons?: Array<_AdditionalButton>;
  // only for workflow and userConfig Forms
  additionalHeaders?: Array<Header>;
  onChange?: string;
  validator?: (arg0: GenObj) => any;
  hasErrors: boolean;
  xhrSubmit: boolean;
  splitPaste: boolean;
  isOwner: boolean;
  onSubmit?: string;
  req: any;
  tabs?: string;
  __?: any;
  isWorkflow?: boolean;
  pk_name?: string;

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
    this.viewname = o.viewname;
    this.layout = o.layout;
    this.id = o.id;
    this.labelCols = o.labelCols;
    this.collapsedSummary = o.collapsedSummary;
    this.formStyle = o.formStyle || "horiz";
    this.class = o.class;
    this.methodGET = !!o.methodGET;
    this.blurb = o.blurb;
    this.submitLabel = o.submitLabel;
    this.submitButtonClass = o.submitButtonClass;
    this.noSubmitButton = o.noSubmitButton;
    this.additionalButtons = o.additionalButtons;
    this.additionalHeaders = o.additionalHeaders;
    this.onChange = o.onChange;
    this.validator = o.validator;
    this.hasErrors = false;
    this.xhrSubmit = !!o.xhrSubmit;
    this.splitPaste = !!o.splitPaste;
    this.onSubmit = o.onSubmit;
    this.tabs = o.tabs;
    this.isOwner = !!o.isOwner;
    this.isWorkflow = !!o.isWorkflow;
    this.pk_name = o.pk_name;
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
  async fill_fkey_options(
    force_allow_none: boolean = false,
    optionsQuery?: any,
    user?: User
  ): Promise<void> {
    //console.log(this.fields);
    const formFieldNames = this.fields
      // @ts-ignore
      .filter((f) => f?.input_type !== "hidden")
      .map((f) => f.name);
    const extraCtx: GenObj = { ...this.values, row: this.values };
    if (user && !extraCtx.user_id) extraCtx.user_id = user.id;
    if (user && !extraCtx.user) extraCtx.user = user;
    for (const f of this.fields) {
      if (hasFieldMembers(f))
        await f.fill_fkey_options(
          force_allow_none,
          undefined,
          extraCtx,
          optionsQuery,
          formFieldNames,
          this.values[f.name] || undefined,
          user
        );
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
      const field = this.fields.find((f) => f.name === k);
      if (field) strs.push(`${field.label}: ${v}`);
      else strs.push(`${k}: ${v}`);
    });
    return strs.join("; ");
  }

  async asyncValidate(v: any): Promise<{ success: any } | { errors: any }> {
    const vres = this.validate(v);
    if (instanceOfErrorMsg(vres)) return vres;
    for (const f of this.fields) {
      let typeObj = f.type as Type;
      if (typeObj?.postProcess) {
        const ppres = await typeObj?.postProcess(this.values[f.name], f);
        if (ppres?.error) {
          this.hasErrors = true;
          this.errors[f.name] = ppres.error;
        } else if (typeof ppres?.success !== "undefined") {
          this.values[f.name] = ppres.success;
        }
      }
    }
    if (this.hasErrors) return { errors: this.errors };
    else return { success: this.values };
  }

  /**
   * @param {*} v
   * @returns {object}
   */
  validate(v: any): { success: any } | { errors: any } {
    this.hasErrors = false;
    this.errors = {};
    this.fields.forEach((f) => {
      // bail out if fieldview is not edit
      if ((f as any)?.fieldviewObj && !(f as any).fieldviewObj.isEdit) return;
      if (f instanceof Field && f?.input_type === "section_header") return;
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
      const showIfFailed = ([k, criteria]: any[]) => {
        if (v[k] && typeof criteria === "string" && v[k] != criteria)
          return true;
        if (
          v[k] &&
          Array.isArray(criteria) &&
          !criteria.some((target) => target == v[k])
        )
          //includes with == instead of ===
          return true;
        if (v[k] && criteria === true && !v[k]) return true;
        if (v[k] && criteria === false && v[k]) return true;
      };
      if (f.showIf && Object.entries(f.showIf).some(showIfFailed)) return;

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
    viewname?: string;
    layout?: Layout;
    id?: string;
    labelCols?: number;
    collapsedSummary?: string;
    formStyle?: string;
    class?: string;
    methodGET?: boolean;
    blurb?: string | string[];
    submitLabel?: string;
    submitButtonClass?: string;
    noSubmitButton?: boolean;
    additionalButtons?: Array<_AdditionalButton>;
    additionalHeaders?: Array<Header>;
    onChange?: string;
    validator?: (arg0: any) => any;
    xhrSubmit?: boolean;
    splitPaste?: boolean;
    isOwner?: boolean;
    onSubmit?: string;
    req?: any;
    tabs?: any;
    validate?: any;
    isWorkflow?: boolean;
    pk_name?: string;
    __?: any;
  };

  export type AdditionalButton = _AdditionalButton;
}
type FormCfg = Form.FormCfg;

export = Form;
