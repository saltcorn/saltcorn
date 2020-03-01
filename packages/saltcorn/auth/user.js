const db = require("../db");
const bcrypt = require("bcrypt");

class User {
  constructor(o) {
    this.email = o.email;
    this.password = o.password;
    this.id = o.id;
    this.role_id = o.role_id;
  }
  static async create(uo) {
    const u = new User(uo);
    const hashpw = await bcrypt.hash(u.password, 5);
    const id = await db.insert("users", {
      email: u.email,
      password: hashpw,
      role_id: this.role_id || 3
    });
    u.id = id;
    return u;
  }
  static async authenticate(uo) {
    const urow = await db.selectOne("users", { email: uo.email });
    if (!urow) return false;
    const cmp = bcrypt.compareSync(uo.password, urow.password);
    if (cmp) return new User(urow);
    else return false;
  }
}

module.exports = User;
