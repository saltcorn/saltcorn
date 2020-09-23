const db = require("../db");
const bcrypt = require("bcryptjs");
const { contract, is } = require("contractis");
const { v4: uuidv4 } = require("uuid");

class User {
  constructor(o) {
    this.email = o.email;
    this.password = o.password;
    this.language = o.language;
    this.id = o.id ? +o.id : o.id;
    this.reset_password_token = o.reset_password_token || null;
    this.reset_password_expiry =
      typeof o.reset_password_expiry === "string" &&
      o.reset_password_expiry.length > 0
        ? new Date(o.reset_password_expiry)
        : o.reset_password_expiry || null;
    this.role_id = o.role_id ? +o.role_id : 8;
    contract.class(this);
  }

  static async hashPassword(pw) {
    return await bcrypt.hash(pw, 5);
  }
  checkPassword(pw) {
    return bcrypt.compareSync(pw, this.password);
  }

  async changePasswordTo(newpw, expireToken) {
    const password = await User.hashPassword(newpw);
    this.password = password;
    const upd = { password };
    if (expireToken) upd.reset_password_token = null;
    await db.update("users", upd, this.id);
  }
  static async create(uo) {
    const u = new User(uo);
    const hashpw = await User.hashPassword(u.password);
    const ex = await User.findOne({ email: u.email });
    if (ex) return { error: `User with this email already exists` };
    const id = await db.insert("users", {
      email: u.email,
      password: hashpw,
      role_id: u.role_id,
    });
    u.id = id;
    return u;
  }

  static async authenticate(uo) {
    const urow = await User.findOne({ email: uo.email });
    if (!urow) return false;
    const cmp = urow.checkPassword(uo.password);
    if (cmp) return new User(urow);
    else return false;
  }
  static async find(where) {
    const us = await db.select("users", where);
    return us.map((u) => new User(u));
  }
  static async findOne(where) {
    const u = await db.selectMaybeOne("users", where);
    return u ? new User(u) : u;
  }
  static async nonEmpty() {
    const res = await db.count("users");
    return res > 0;
  }
  async delete() {
    const schema = db.getTenantSchemaPrefix();
    await db.query(`delete FROM ${schema}users WHERE id = $1`, [this.id]);
  }

  async set_language(language) {
    await db.update("users", { language }, this.id);
  }

  async getNewResetToken() {
    const reset_password_token = uuidv4();
    const reset_password_expiry = new Date();
    reset_password_expiry.setDate(new Date().getDate() + 1);
    await db.update(
      "users",
      { reset_password_token, reset_password_expiry },
      this.id
    );
    return reset_password_token;
  }

  static async resetPasswordWithToken({
    email,
    reset_password_token,
    password,
  }) {
    if (
      typeof reset_password_token !== "string" ||
      reset_password_token.length < 10
    )
      return { error: "Invalid token" };
    const u = await User.findOne({ reset_password_token, email });
    if (u && new Date() < u.reset_password_expiry) {
      await u.changePasswordTo(password, true);
      return { success: true };
    } else {
      return { error: "User not found or expired token" };
    }
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
    language: is.maybe(is.str),
    role_id: is.posint,
    reset_password_token: is.maybe(
      is.and(
        is.str,
        is.sat((s) => s.length > 10)
      )
    ),
    reset_password_expiry: is.maybe(is.class("Date")),
  },
  methods: {
    delete: is.fun([], is.promise(is.undefined)),
    changePasswordTo: is.fun(is.str, is.promise(is.undefined)),
    checkPassword: is.fun(is.str, is.bool),
  },
  static_methods: {
    find: is.fun(is.maybe(is.obj()), is.promise(is.array(is.class("User")))),
    findOne: is.fun(is.obj(), is.promise(is.maybe(is.class("User")))),
    nonEmpty: is.fun([], is.promise(is.bool)),
    hashPassword: is.fun(is.str, is.promise(is.str)),
    authenticate: is.fun(
      is.obj({ email: is.str, password: is.str }),
      is.promise(is.or(is.class("User"), is.eq(false)))
    ),
    create: is.fun(
      is.obj({ email: is.str }),
      is.promise(is.or(is.obj({ error: is.str }), is.class("User")))
    ),
    get_roles: is.fun(
      [],
      is.promise(is.array(is.obj({ id: is.posint, role: is.str })))
    ),
  },
};

module.exports = User;
