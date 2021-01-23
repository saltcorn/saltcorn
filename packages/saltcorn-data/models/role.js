const db = require("../db");
const { contract, is } = require("contractis");
class Role {
  constructor(o) {
    this.id = o.id;
    this.role = o.role;
    contract.class(this);
  }
  static async create(uo) {
    const u = new Role(uo);

    const ex = await Role.findOne({ id: u.id });
    if (ex) return { error: `Role with this email already exists` };
    await db.insert("_sc_roles", {
      id: u.id,
      role: u.role,
    });
    return u;
  }

  static async find(where, selectopts) {
    const us = await db.select("_sc_roles", where, selectopts);
    return us.map((u) => new Role(u));
  }
  static async findOne(where) {
    const u = await db.selectMaybeOne("_sc_roles", where);
    return u ? new Role(u) : u;
  }

  async delete() {
    const schema = db.getTenantSchemaPrefix();
    await db.query(`delete FROM ${schema}_sc_roles WHERE id = $1`, [this.id]);
  }

  async update(row) {
    await db.update("_sc_roles", row, this.id);
  }
}

Role.contract = {
  variables: {
    id: is.posint,
    role: is.str,
  },
  methods: {
    delete: is.fun([], is.promise(is.undefined)),
  },
  static_methods: {
    find: is.fun(is.maybe(is.obj()), is.promise(is.array(is.class("Role")))),
    findOne: is.fun(is.obj(), is.promise(is.maybe(is.class("Role")))),
    create: is.fun(
      is.obj({ id: is.posint, role: is.str }),
      is.promise(is.or(is.obj({ error: is.str }), is.class("Role")))
    ),
  },
};

module.exports = Role;
