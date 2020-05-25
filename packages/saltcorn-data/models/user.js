const db = require("../db");
const bcrypt = require("bcryptjs");

class User {
  constructor(o) {
    this.email = o.email;
    this.password = o.password;
    this.id = o.id;
    this.role_id = o.role_id || 8;
  }
  static async create(uo) {
    const u = new User(uo);
    const hashpw = await bcrypt.hash(u.password, 5);
    const id = await db.insert("users", {
      email: u.email,
      password: hashpw,
      role_id: u.role_id
    });
    u.id = id;
    return u;
  }
  static async authenticate(uo) {
    const urow = await db.selectMaybeOne("users", { email: uo.email });
    if (!urow) return false;
    const cmp = bcrypt.compareSync(uo.password, urow.password);
    if (cmp) return new User(urow);
    else return false;
  }
  static async find(where) {
    const us = await db.select("users", where);
    return us.map(u => new User(u));
  }
  static async findOne(where) {
    const u = await db.selectOne("users", where);
    return new User(u);
  }
  async delete() {
    const schema = db.getTenantSchema();
    await db.query(`delete FROM "${schema}".users WHERE id = $1`, [this.id]);
  }
  static async get_roles() {
    const rs = await db.select("_sc_roles", {}, { orderBy: "id" });
    return rs;
  }
}

module.exports = User;
