const types = require("../types");
const db = require("../db");

const fkeyPrefix = "Key to ";

class Field {
    constructor(o) {
        this.label=o.flabel
        this.name=o.fname
        this.type=types.as_dict[o.ftype]
        this.is_fkey=o.ftype.startsWith(fkeyPrefix)
    }

    to_formfield() {
        this.is_fkey ?  {
            label: this.label,
            name: this.name,
            input_type: "number"
          }
        : {
            label: this.label,
            name: this.name,
            type: this.type,
            input_type: "fromtype"
          };
    }
}
module.exports =Field;