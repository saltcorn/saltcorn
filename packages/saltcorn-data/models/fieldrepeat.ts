/**
 * FieldRepeat Database Access Layer
 * @category saltcorn-data
 * @module models/fieldrepeat
 * @subcategory models
 */
const { contract, is } = require("contractis");
import Field from "./field";
import { AbstractFieldRepeat } from "@saltcorn/types/model-abstracts/abstract_field";
import { instanceOfType, SuccessMessage } from "@saltcorn/types/common_types";
import type { Layout } from "@saltcorn/types/base_types";
import type { FieldLike } from "@saltcorn/types/base_types";
import { PartialSome } from "@saltcorn/db-common/internal";

/**
 * FieldRepeat Class
 * @category saltcorn-data
 */
class FieldRepeat implements AbstractFieldRepeat {
  label: string;
  name: string;
  type: string;
  fields: Array<Field | FieldRepeat>;
  layout?: Layout;
  isRepeat = true;
  showIf?: any;
  fancyMenuEditor: boolean;
  metadata?: any;
  defaultNone: boolean;

  /**
   * FieldRepeat constructor
   * @param {object} o
   */
  constructor(o: FieldRepeatCfg) {
    this.label = o.label || o.name;
    this.name = o.name;
    this.type = "FieldRepeat";
    this.fields = o.fields
      .filter((f) => f.name || f.label)
      .map((f) => (f.constructor.name === Object.name ? new Field(f) : f));
    this.layout = o.layout;
    this.isRepeat = true;
    this.showIf = o.showIf;
    this.metadata = o.metadata;
    this.fancyMenuEditor = o.fancyMenuEditor || false;
    this.defaultNone = o.defaultNone || false;
  }
  get required() {
    return false;
  }
  get attributes() {
    return {};
  }
  /**
   * @returns {Promise<void>}
   */
  async generate() {
    const nrepeats = Math.round(Math.random() * 5);
    var r: any = {};
    for (let index = 0; index < nrepeats; index++) {
      for (const f of this.fields) {
        if ((f as any).generate && (f.required || is.bool.generate())) {
          r[`${f.name}_${index}`] = await (f as any).generate();
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
  validate_from_ix(
    whole_rec: any,
    ix: number,
    nameAdd: string = ""
  ): SuccessMessage {
    var has_any = false;
    var res: any = {};

    this.fields.forEach((f) => {
      if (f.isRepeat) {
        const valres = (f as FieldRepeat).validate_from_ix(
          whole_rec,
          0,
          "_" + ix
        );

        if (valres.success.length) {
          res[f.name] = valres.success;
          has_any = true;
        }
        return;
      }
      const fval = whole_rec[`${f.name}${nameAdd}_${ix}`];

      if (typeof fval !== "undefined") {
        if (instanceOfType(f.type) && f.type?.read) {
          res[f.name] = f.type.read(fval, f.attributes);
        } else res[f.name] = fval;
        has_any = true;
      }
      if (
        f.type === "File" &&
        whole_rec._file_names &&
        whole_rec._file_names.includes(`${f.name}${nameAdd}_${ix}`)
      )
        has_any = true;
    });
    if (has_any) {
      const rest = this.validate_from_ix(whole_rec, ix + 1, nameAdd);
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

type FieldRepeatCfg = PartialSome<FieldRepeat, "name" | "fields">;

export = FieldRepeat;
