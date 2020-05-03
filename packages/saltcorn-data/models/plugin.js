const db = require("../db");
const { contract, is } = require("contractis");

const fetch = require("node-fetch");

class Plugin {
  constructor(o) {
    this.id = o.id;
    this.name = o.name;
    this.source = o.source;
    this.location = o.location;
  }
  static async findOne(where) {
    return await db.selectOne("plugins", where);
  }
  static async find(where) {
    return await db.select("plugins", where);
  }
  async upsert() {
    const row = {
      name: this.name,
      source: this.source,
      location: this.location
    };
    if (typeof this.id === "undefined") {
      // insert
      await db.insert("plugins", row);
    } else {
      await db.update("plugins", row, this.id);
    }
  }
  static async deleteWhere(where) {
    await db.deleteWhere("plugins", where);
  }
  static async store_plugins_available() {
    const response = await fetch("https://www.saltcorn.com/api/extensions");
    const json = await response.json();
    return json.success.map(p => new Plugin(p));
  }

  static async store_by_name(name) {
    const response = await fetch(
      "https://www.saltcorn.com/api/extensions?name=" + encodeURIComponent(name)
    );
    const json = await response.json();
    if (json.success.length == 1) return new Plugin(json.success[0]);
    else return null;
  }
}

module.exports = Plugin;
