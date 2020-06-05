const db = require("../db");
const moment = require("moment");

class Crash {
  constructor(o) {
    this.id = o.id;
    this.stack = o.stack;
    this.message = o.message;
    this.occur_at = o.occur_at;
    this.tenant = o.tenant;
    this.user_id = o.user_id;
    this.url = o.url;
    this.headers = o.headers;
  }
  static async find(where) {
    const us = await db.select("_sc_errors", where);
    return us.map(u => new Crash(u));
  }
  static async findOne(where) {
    const u = await db.selectOne("_sc_errors", where);
    return new Crash(u);
  }
  get reltime() {
      return moment(this.occur_at).fromNow()
  }
  static async create(err, req) {
      const schema = db.getTenantSchema()
    db.runWithTenant("public", async () => {
      await db.insert("_sc_errors", {
        stack: err.stack,
        message: err.message,
        occur_at: new Date(),
        tenant: schema,
        user_id: req.user ? req.user.id : null,
        url: req.url,
        headers: req.headers
      });
    });
  }
}

module.exports = Crash;
