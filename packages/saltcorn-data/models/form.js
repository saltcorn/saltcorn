const { contract, is } = require("contractis");
const db = require("../db");
const Field = require("./field");

class Form {
  constructor(o) {
    this.fields = o.fields.map(f =>
      f.constructor.name === Object.name ? new Field(f) : f
    );
    this.errors = o.errors || {};
    this.values = o.values || {};
    this.action = o.action;
    this.collapsedSummary = o.collapsedSummary;
    this.isStateForm = o.isStateForm;
    this.formStyle = o.formStyle || "horiz";
    this.class = o.class;
    this.methodGET = o.methodGET;
    this.blurb = o.blurb;
    this.submitLabel = o.submitLabel;
    if (o.validate) this.validate(o.validate);
    contract.class(this);
  }
  hidden(...ks) {
    ks.forEach(k => {
      this.fields.push(
        new Field({
          name: k,
          input_type: "hidden"
        })
      );
    });
  }
  async fill_fkey_options(force_allow_none = false) {
    for (const f of this.fields) {
      await f.fill_fkey_options(force_allow_none);
    }
  }

  async generate() {
    var r = {};

    for (const f of this.fields) {
      if (f.input_type === "hidden") r[f.name] = this.values[f.name];
      else if (f.required || is.bool.generate()) {
        r[f.name] = await f.generate();
      }
    }
    return r;
  }

  validate(v) {
    this.fields.forEach(f => {
      const valres = f.validate(v);
      if (valres.error) {
        this.errors[f.name] = valres.error;
        this.values[f.name] = v[f.name];
        this.hasErrors = true;
      } else {
        this.values[f.name] = valres.success;
      }
    });

    if (Object.keys(this.errors).length > 0) {
      return { errors: this.errors };
    } else {
      return { success: this.values };
    }
  }
}

Form.contract = {
  variables: {
    fields: is.array(is.or(is.class("Field"), is.class("FieldRepeat"))),
    values: is.obj(),
    errors: is.obj()
  },
  methods: {
    validate: is.fun(
      is.obj(),
      is.or(is.obj({ errors: is.obj() }), is.obj({ success: is.obj() }))
    ),
    generate: is.fun([], is.promise(is.obj())),
    fill_fkey_options: is.fun(is.maybe(is.bool), is.promise()),
    hidden: is.fun(is.any, is.eq(undefined))
  }
};

module.exports = Form;
