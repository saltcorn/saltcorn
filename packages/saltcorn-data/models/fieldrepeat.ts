/**
 * FieldRepeat Database Access Layer
 * @category saltcorn-data
 * @module models/fieldrepeat
 * @subcategory models
 */
const { contract, is } = require("contractis");
import Field from "./field";
import { AbstractFieldRepeat } from "@saltcorn/types/model-abstracts/abstract_field";
import { SuccessMessage } from "@saltcorn/types/common_types";

/**
 * FieldRepeat Class
 * @category saltcorn-data
 */
class FieldRepeat implements AbstractFieldRepeat {
  label: string;
  name: string;
  type: string;
  fields: Array<Field>;
  isRepeat = true;
  showIf?: any;

  /**
   * FieldRepeat constructor
   * @param {object} o
   */
  constructor(o: FieldRepeatCfg) {
    this.label = o.label || o.name;
    this.name = o.name;
    this.type = "FieldRepeat";
    this.fields = o.fields.map((f) =>
      f.constructor.name === Object.name ? new Field(f) : f
    );
    this.isRepeat = true;
    this.showIf = o.showIf;
  }

  /**
   * @returns {Promise<void>}
   */
  async generate() {
    const nrepeats = Math.round(Math.random() * 5);
    var r: any = {};
    for (let index = 0; index < nrepeats; index++) {
      for (const f of this.fields) {
        if (f.required || is.bool.generate()) {
          r[`${f.name}_${index}`] = await f.generate();
        }
      }
    }
  }

  /**
   * @param {*} whole_rec
   * @returns {object}
   */
  validate(whole_rec: any): { errors: any } | { success: any } {
    return this.validate_from_ix(whole_rec, 0);
  }

  /**
   * @param {*} whole_rec
   * @param {*} ix
   * @returns {object}
   */
  validate_from_ix(whole_rec: any, ix: number): SuccessMessage {
    var has_any = false;
    var res: any = {};

    this.fields.forEach((f) => {
      const fval = whole_rec[`${f.name}_${ix}`];
      if (typeof fval !== "undefined") {
        has_any = true;
        res[f.name] = fval;
      }
    });
    if (has_any) {
      const rest = this.validate_from_ix(whole_rec, ix + 1);
      return { success: [res, ...rest.success] };
    } else return { success: [] };
  }

  /**
   * @type {string}
   */
  get form_name(): string {
    return this.name;
  }
}

namespace FieldRepeat {
  export type FieldRepeatCfg = {
    name: string;
    label?: string;
    fields: Array<Field>;
    showIf?: any;
  };
}
type FieldRepeatCfg = FieldRepeat.FieldRepeatCfg;
export = FieldRepeat;
