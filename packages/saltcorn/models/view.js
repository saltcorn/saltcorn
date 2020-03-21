const db = require("../db");
const Form = require("../models/form");

const removeEmptyStrings = obj => {
  var o = {};
  Object.entries(obj).forEach(kv => {
    if (kv[1] !== "") o[kv[0]] = kv[1];
  });
  return o;
};

class View {
  constructor(o) {
    this.name = o.name;
    this.id = o.id;
    this.viewtemplate = o.viewtemplate;
    if (o.table_id) this.table_id = o.table_id;

    if (o.table) {
      this.table = o.table;
      if (o.table.id && !o.table_id) this.table_id = o.table.id;
    }
    this.configuration = o.configuration;
    this.is_public = o.is_public;
    this.on_root_page = o.on_root_page;
    this.on_menu = o.on_menu;
    const viewtemplates = require("../viewtemplates");
    this.viewtemplateObj = viewtemplates[this.viewtemplate];
  }
  static async findOne(where) {
    const v = await db.selectOne("views", where);

    return new View(v);
  }
  static async find(where) {
    const views = await db.select("views", where);

    return views.map(v => new View(v));
  }

  static async create(v) {
    const id = await db.insert("views", v);

    return new View({ id, ...v });
  }
  async delete() {
    await db.query("delete FROM views WHERE id = $1", [this.id]);
  }

  async run(query) {
    return await this.viewtemplateObj.run(
      this.table_id,
      this.name,
      this.configuration,
      removeEmptyStrings(query)
    );
  }
  async get_state_form(query) {
    if (this.viewtemplateObj.display_state_form) {
      const fields = await this.viewtemplateObj.get_state_fields(
        this.table_id,
        this.name,
        this.configuration
      );
      const form = new Form({
        methodGET: true,
        action: `/view/${this.name}`,
        fields,
        submitLabel: "Apply",
        values: query
      });
      return form;
    } else return null;
  }
}
module.exports = View;
