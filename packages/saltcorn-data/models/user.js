const db = require("../db");
const bcrypt = require("bcryptjs");
const { contract, is } = require("contractis");
const { v4: uuidv4 } = require("uuid");
const dumbPasswords = require("dumb-passwords");
const validator = require("email-validator");

class User {
  constructor(o) {
    this.email = o.email;
    this.password = o.password;
    this.language = o.language;
    this._attributes =
      typeof o._attributes === "string"
        ? JSON.parse(o._attributes)
        : o._attributes || {};
    this.api_token = o.api_token;
    this.verification_token = o.verification_token;
    this.verified_on = ["string", "number"].includes(typeof o.verified_on)
      ? new Date(o.verified_on)
      : o.verified_on;
    this.disabled = !!o.disabled;
    this.id = o.id ? +o.id : o.id;
    this.reset_password_token = o.reset_password_token || null;
    this.reset_password_expiry =
      (typeof o.reset_password_expiry === "string" &&
        o.reset_password_expiry.length > 0) ||
      typeof o.reset_password_expiry === "number"
        ? new Date(o.reset_password_expiry)
        : o.reset_password_expiry || null;
    this.role_id = o.role_id ? +o.role_id : 8;
    contract.class(this);
  }

  static async hashPassword(pw) {
    return await bcrypt.hash(pw, 10);
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

  static async findOrCreateByAttribute(k, v, uo = {}) {
    const u = await User.findOne({ _attributes: { json: [k, v] } });
    if (u) return u;
    else {
      const { getState } = require("../db/state");
      const email_mask = getState().getConfig("email_mask");
      if (email_mask && uo.email) {
        const { check_email_mask } = require("./config");
        if (!check_email_mask(uo.email)) {
          return false;
        }
      }
      const new_user_form = getState().getConfig("new_user_form");
      if (new_user_form) {
        // cannot create user, return pseudo-user
        const pseudoUser = { ...uo, _attributes: { [k]: v } };
        return { ...pseudoUser, session_object: pseudoUser };
      } else {
        const extra = {};
        if (!uo.password) extra.password = User.generate_password();
        return await User.create({ ...uo, ...extra, _attributes: { [k]: v } });
      }
    }
  }
  static async create(uo) {
    const { email, password, passwordRepeat, role_id, ...rest } = uo;
    const u = new User({ email, password, role_id });
    if (User.unacceptable_password_reason(u.password))
      return {
        error:
          "Password not accepted: " +
          User.unacceptable_password_reason(u.password),
      };
    const hashpw = await User.hashPassword(u.password);
    const ex = await User.findOne({ email: u.email });
    if (ex) return { error: `User with this email already exists` };
    const id = await db.insert("users", {
      email: u.email,
      password: hashpw,
      role_id: u.role_id,
      ...rest,
    });
    u.id = id;
    return u;
  }

  get session_object() {
    return {
      email: this.email,
      id: this.id,
      role_id: this.role_id,
      language: this.language,
      tenant: db.getTenantSchema(),
    };
  }
  static async authenticate(uo) {
    const { password, ...uoSearch } = uo;
    const urows = await User.find(uoSearch, { limit: 2 });
    if (urows.length !== 1) return false;
    const [urow] = urows;
    if (urow.disabled) return false;
    const cmp = urow.checkPassword(password);
    if (cmp) return new User(urow);
    else return false;
  }
  static async find(where, selectopts) {
    const us = await db.select("users", where, selectopts);
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
    this.destroy_sessions();
    await db.query(`delete FROM ${schema}users WHERE id = $1`, [this.id]);
  }

  async set_language(language) {
    await this.update({ language });
  }
  async update(row) {
    await db.update("users", row, this.id);
  }
  async getNewResetToken() {
    const reset_password_token_uuid = uuidv4();
    const reset_password_expiry = new Date();
    reset_password_expiry.setDate(new Date().getDate() + 1);
    const reset_password_token = await bcrypt.hash(
      reset_password_token_uuid,
      10
    );
    await db.update(
      "users",
      { reset_password_token, reset_password_expiry },
      this.id
    );
    return reset_password_token_uuid;
  }
  async getNewAPIToken() {
    const api_token = uuidv4();
    await db.update("users", { api_token }, this.id);
    this.api_token = api_token;
    return api_token;
  }

  static unacceptable_password_reason(pw) {
    if (typeof pw !== "string") return "Not a string";
    if (pw.length < 8) return "Too short";
    if (dumbPasswords.check(pw)) return "Too common";
  }

  static valid_email(email) {
    return validator.validate(email);
  }

  static async verifyWithToken({ email, verification_token }) {
    if (
      typeof verification_token !== "string" ||
      typeof email !== "string" ||
      verification_token.length < 10 ||
      !email
    )
      return { error: "Invalid token" };
    const u = await User.findOne({ email, verification_token });
    if (!u) return { error: "Invalid token" };
    const upd = { verified_on: new Date() };
    const { getState } = require("../db/state");

    const elevate_verified = +getState().getConfig("elevate_verified");
    if (elevate_verified) upd.role_id = Math.min(elevate_verified, u.role_id);
    await db.update("users", upd, u.id);
    return true;
  }

  static async resetPasswordWithToken({
    email,
    reset_password_token,
    password,
  }) {
    if (
      typeof reset_password_token !== "string" ||
      typeof email !== "string" ||
      reset_password_token.length < 10
    )
      return { error: "Invalid token" };
    const u = await User.findOne({ email });
    if (u && new Date() < u.reset_password_expiry && u.reset_password_token) {
      const match = bcrypt.compareSync(
        reset_password_token,
        u.reset_password_token
      );
      if (match) {
        if (User.unacceptable_password_reason(password))
          return {
            error:
              "Password not accepted: " +
              User.unacceptable_password_reason(password),
          };
        await u.changePasswordTo(password, true);
        return { success: true };
      } else return { error: "User not found or expired token" };
    } else {
      return { error: "User not found or expired token" };
    }
  }
  static async count(where) {
    return await db.count("users", where || {});
  }

  static async get_roles() {
    const rs = await db.select("_sc_roles", {}, { orderBy: "id" });
    return rs;
  }
  static generate_password() {
    const candidate = is.str.generate().split(" ").join("");
    if (candidate.length < 10) return User.generate_password();
    else return candidate;
  }
  async destroy_sessions() {
    if (!db.isSQLite) {
      const schema = db.getTenantSchema();

      await db.query(
        `delete from _sc_session 
        where sess->'passport'->'user'->>'id' = $1 
        and sess->'passport'->'user'->>'tenant' = $2`,
        [`${this.id}`, schema]
      );
    }
  }
  relogin(req) {
    req.login(
      this.session_object,
      function (err) {
        if (err) req.flash("danger", err);
      }
    );
  }
}

User.contract = {
  variables: {
    id: is.maybe(is.posint),
    email: is.str,
    //password: is.str,
    disabled: is.bool,
    language: is.maybe(is.str),
    _attributes: is.maybe(is.obj({})),
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
    destroy_sessions: is.fun([], is.promise(is.undefined)),
    changePasswordTo: is.fun(is.str, is.promise(is.undefined)),
    checkPassword: is.fun(is.str, is.bool),
  },
  static_methods: {
    find: is.fun(is.maybe(is.obj()), is.promise(is.array(is.class("User")))),
    findOne: is.fun(is.obj(), is.promise(is.maybe(is.class("User")))),
    nonEmpty: is.fun([], is.promise(is.bool)),
    hashPassword: is.fun(is.str, is.promise(is.str)),
    authenticate: is.fun(
      is.objVals(is.str),
      is.promise(is.or(is.class("User"), is.eq(false)))
    ),
    verifyWithToken: is.fun(
      is.obj({ email: is.str, verification_token: is.str }),
      is.promise(is.any)
    ),
    resetPasswordWithToken: is.fun(
      is.obj({ email: is.str, reset_password_token: is.str, password: is.str }),
      is.promise(is.any)
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
