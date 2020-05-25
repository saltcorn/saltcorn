const db = require("../db");
const { contract, is } = require("contractis");
const View = require("./view");
const fetch = require("node-fetch");

class Plugin {
  constructor(o) {
    this.id = o.id;
    this.name = o.name;
    this.source = o.source;
    this.location = o.location;
    this.version = o.version;
  }
  static async findOne(where) {
    return new Plugin(await db.selectOne("_sc_plugins", where));
  }
  static async find(where) {
    return (await db.select("_sc_plugins", where)).map(p => new Plugin(p));
  }
  async upsert() {
    const row = {
      name: this.name,
      source: this.source,
      location: this.location,
      version: this.version
    };
    if (typeof this.id === "undefined") {
      // insert
      await db.insert("_sc_plugins", row);
    } else {
      await db.update("_sc_plugins", row, this.id);
    }
  }
  async delete() {
    await db.deleteWhere("_sc_plugins", { id: this.id });
  }

  async dependant_views() {
    const views = await View.find({});
    const { getState } = require("../db/state");
    const myViewTemplates = getState().plugins[this.name].viewtemplates || [];
    const vt_names = myViewTemplates.map(vt => vt.name);
    return views
      .filter(v => vt_names.includes(v.viewtemplate))
      .map(v => v.name);
  }

  static async store_plugins_available() {
    const response = await fetch("http://store.saltcorn.com/api/extensions");
    const json = await response.json();
    return json.success.map(p => new Plugin(p));
  }

  static async store_by_name(name) {
    const response = await fetch(
      "http://store.saltcorn.com/api/extensions?name=" +
        encodeURIComponent(name)
    );
    const json = await response.json();
    if (json.success.length == 1)
      return new Plugin({ version: "latest", ...json.success[0] });
    else return null;
  }
}

module.exports = Plugin;
