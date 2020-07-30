const db = require("../db");
const bcrypt = require("bcryptjs");
const { contract, is } = require("contractis");

class User {
  constructor(o) {
    this.email = o.email;
    this.password = o.password;
    this.id = o.id;
    this.role_id = o.role_id || 8;
    contract.class(this);
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
  static async nonEmpty() {
    const res = await db.count("users");
    return res > 0;
  }
  async delete() {
    const schema = db.getTenantSchemaPrefix();
    await db.query(`delete FROM ${schema}users WHERE id = $1`, [this.id]);
  }
  static async get_roles() {
    const rs = await db.select("_sc_roles", {}, { orderBy: "id" });
    return rs;
  }
}

User.contract = {
  variables: {
    id: is.maybe(is.posint),
    email: is.str,
    password: is.str,
    role_id: is.posint
  },
  methods: {
    delete: is.fun([], is.promise(is.undefined))
  },
  static_methods: {
    find: is.fun(is.maybe(is.obj()), is.promise(is.array(is.class("User")))),
    findOne: is.fun(is.obj(), is.promise(is.class("User"))),
    nonEmpty: is.fun([], is.promise(is.bool)),
    authenticate: is.fun(
      is.obj({ email: is.str, password: is.str }),
      is.promise(is.or(is.class("User"), is.eq(false)))
    ),
    create: is.fun(is.obj({ email: is.str }), is.promise(is.class("User"))),
    get_roles: is.fun(
      [],
      is.promise(is.array(is.obj({ id: is.posint, role: is.str })))
    )
  }
};

module.exports = User;
