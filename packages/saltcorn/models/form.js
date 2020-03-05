const types = require("../types");
const db = require("../db");
const Field = require("../db/field");

class Form {
  constructor(o) {
    this.fields = o.fields;
    this.errors = o.errors || {};
    this.values = o.values || {};
    this.action = o.action;
  }
  hidden(k) {
    this.fields.push(
      new Field({
        fname: k,
        ftype: "hidden"
      })
    );
  }
  validate(v) {
    this.fields.forEach(f => {
      const valres = f.validate(v);
      if (valres.error) {
        this.errors[f.name] = valres.error;
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

module.exports = Form;
