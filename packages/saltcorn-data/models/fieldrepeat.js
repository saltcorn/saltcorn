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
}
module.exports = FieldRepeat;
