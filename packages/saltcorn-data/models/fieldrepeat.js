const Field = require("./field");

class FieldRepeat {
  constructor(o) {
    this.label = o.label || o.name;
    this.name = o.name;
    this.fields = o.fields.map(f =>
      f.constructor.name === Object.name ? new Field(f) : f
    );
    this.isRepeat = true;
  }
  validate(whole_rec) {
    return this.validate_from_ix(whole_rec, 0);
  }
  validate_from_ix(whole_rec, ix) {
    var has_any = false;
    var res = {};
    //console.log({whole_rec})
    //console.log(this.fields)

    this.fields.forEach(f => {
      const fval = whole_rec[`${f.name}_${ix}`];
      console.log(f.name, fval);
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
}
module.exports = FieldRepeat;
