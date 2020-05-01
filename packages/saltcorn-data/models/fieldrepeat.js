const { contract, is } = require("contractis");
const Field = require("./field");

class FieldRepeat {
  constructor(o) {
    this.label = o.label || o.name;
    this.name = o.name;
    this.fields = o.fields.map(f =>
      f.constructor.name === Object.name ? new Field(f) : f
    );
    this.isRepeat = true;
    contract.class(this);
  }
  async generate() {
    const nrepeats = Math.round(Math.random() * 5);
    var r = {};
    for (let index = 0; index < nrepeats; index++) {
      for (const f of this.fields) {
        if (f.required || is.bool.generate()) {
          r[`${f.name}_${index}`] = await f.generate();
        }
      }
    }
  }
  validate(whole_rec) {
    return this.validate_from_ix(whole_rec, 0);
  }
  validate_from_ix(whole_rec, ix) {
    var has_any = false;
    var res = {};

    this.fields.forEach(f => {
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
}

FieldRepeat.contract = {
  variables: {
    name: is.str,
    label: is.str,
    fields: is.array(is.class("Field"))
  },
  methods: {
    validate: is.fun(
      is.obj(),
      is.or(is.obj({ errors: is.obj() }), is.obj({ success: is.obj() }))
    )
  }
};
module.exports = FieldRepeat;
