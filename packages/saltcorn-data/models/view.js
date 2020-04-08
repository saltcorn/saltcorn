const db = require("../db");
const Form = require("../models/form");
const Table = require("../models/table");

const removeEmptyStrings = obj => {
  var o = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== "" && v !== null) o[k] = v;
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

  static async find_table_views_where(table_id, pred) {
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
        if (pred({viewrow, viewtemplate: vt, state_fields: sfs}))
           link_view_opts.push(viewrow);
      }
    }
    return link_view_opts;
  }

  static async find_possible_links_to_table(table_id) {
    return View.find_table_views_where(table_id,
      ({state_fields})=> state_fields.some(sf => sf.name === "id") );
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

  async runPost(query, body, res) {
    return await this.viewtemplateObj.runPost(
      this.table_id,
      this.name,
      this.configuration,
      removeEmptyStrings(query),
      removeEmptyStrings(body),
      res
    );
  }
  async get_state_form(query) {
    if (this.viewtemplateObj.display_state_form) {
      const fields = await this.viewtemplateObj.get_state_fields(
        this.table_id,
        this.name,
        this.configuration
      );
      fields.forEach(f => {
        f.required = false;
      });
      const form = new Form({
        methodGET: true,
        action: `/view/${this.name}`,
        fields,
        submitLabel: "Apply",
        isStateForm: true,
        values: removeEmptyStrings(query)
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
