const db = require("../db");
const Form = require("../models/form");
const Table = require("../models/table");

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
    const State = require("../db/state");
    this.viewtemplateObj = State.viewtemplates[this.viewtemplate];
  }
  static async findOne(where) {
    const v = await db.selectOne("views", where);
    return new View(v);
  }
  static async find(where) {
    const views = await db.select("views", where);

    return views.map(v => new View(v));
  }

  static async find_possible_links_to_table(table_id) {
    var link_view_opts = [];
    const State = require("../db/state");
    const link_views = await View.find({
      table_id
    });

    for (const viewrow of link_views) {
      const vt = State.viewtemplates[viewrow.viewtemplate];
      if (vt.get_state_fields) {
        const sfs = await vt.get_state_fields(
          viewrow.table_id,
          viewrow.name,
          viewrow.configuration
        );
        if (sfs.some(sf => sf.name === "id")) link_view_opts.push(viewrow);
      }
    }
    return link_view_opts;
  }

  static async create(v) {
    const id = await db.insert("views", v);
    await require("../db/state").refresh();
    return new View({ id, ...v });
  }
  async delete() {
    await db.query("delete FROM views WHERE id = $1", [this.id]);
  }
  static async update(v, id) {
    await db.update("views", v, id);
    await require("../db/state").refresh();
  }
  static async delete(where) {
    await db.deleteWhere("views", where);
    await require("../db/state").refresh();
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
        class: "stateForm",
        submitLabel: "Apply",
        values: query
      });
      await form.fill_fkey_options(true);
      return form;
    } else return null;
  }

  async get_config_flow() {
    const configFlow = this.viewtemplateObj.configuration_workflow();
    configFlow.action = `/viewedit/config/${this.name}`;
    const oldOnDone = configFlow.onDone || (c => c);
    configFlow.onDone = async ctx => {
      const { table_id, ...configuration } = oldOnDone(ctx);

      await View.update({ configuration }, this.id);

      return { redirect: `/viewedit/list` };
    };
    return configFlow;
  }
}
module.exports = View;
