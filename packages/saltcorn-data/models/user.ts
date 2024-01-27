/**
 * @category saltcorn-data
 * @module models/user
 * @subcategory models
 */
import db from "../db";
import { compareSync, hash } from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { check } from "dumb-passwords";
import { validate } from "email-validator";
import Trigger from "./trigger";
import Table from "./table";

import { Row, SelectOptions, Where } from "@saltcorn/db-common/internal";
import type {
  ErrorMessage,
  GenObj,
  SuccessMessage,
} from "@saltcorn/types/common_types";
import generators from "@saltcorn/types/generators";
const { generateString } = generators;

/**
 * @param {object} o
 * @returns {*}
 */
const safeUserFields = (o: UserCfg | User): any => {
  const {
    email,
    password,
    language,
    _attributes,
    api_token,
    verification_token,
    verified_on,
    disabled,
    id,
    reset_password_token,
    reset_password_expiry,
    role_id,
    ...rest
  } = o;
  return rest;
};

/**
 * prepare a Date for the user object
 * @param date date in different formats
 * @returns
 */
const convertDateParam = (
  date?: Date | number | string | null
): Date | null => {
  return (typeof date === "string" && date.length > 0) ||
    typeof date === "number"
    ? new Date(date)
    : date instanceof Date
    ? date
    : null;
};
/**
 * User
 * @category saltcorn-data
 */
class User {
  email: string;
  password: string;
  language?: string;
  _attributes?: any;
  api_token?: string | null;
  verification_token?: string;
  verified_on?: Date;
  disabled: boolean;
  id?: number;
  reset_password_token?: string | null; // 10 chars length
  reset_password_expiry?: Date | null;
  role_id: number;
  last_mobile_login?: Date | null;
  [key: string]: any;

  /**
   * User constructor
   * @param {object} o
   */
  constructor(o: UserCfg | User) {
    this.email = o.email;
    this.password = o.password;
    this.language = o.language;
    this._attributes =
      typeof o._attributes === "string"
        ? JSON.parse(o._attributes)
        : o._attributes || {};
    this.api_token = o.api_token;
    this.verification_token = o.verification_token;
    this.verified_on =
      typeof o.verified_on === "string" || typeof o.verified_on === "number"
        ? new Date(o.verified_on)
        : o.verified_on;
    this.disabled = !!o.disabled;
    if (o.id) this.id = +o.id as number;
    this.reset_password_token = o.reset_password_token || null;
    this.reset_password_expiry = convertDateParam(o.reset_password_expiry);
    this.role_id = o.role_id ? +o.role_id : 80;
    this.last_mobile_login = convertDateParam(o.last_mobile_login);
    Object.assign(this, safeUserFields(o));
  }

  /**
   * Get bcrypt hash for Password
   * @param pw - password string
   * @returns {Promise<string>}
   */
  static async hashPassword(pw: string): Promise<string> {
    return await hash(pw, 10);
  }

  /**
   * Check password
   * @param pw - password string
   * @returns {boolean}
   */
  checkPassword(pw: string): boolean {
    return compareSync(pw, this.password);
  }

  /**
   * Change password
   * @param newpw - new password string
   * @param expireToken - if true than force reset password token
   * @returns {Promise<void>} no result
   */
  async changePasswordTo(newpw: string, expireToken?: boolean): Promise<void> {
    const password = await User.hashPassword(newpw);
    this.password = password;
    const upd: Row = { password };
    if (expireToken) upd.reset_password_token = null;
    await this.update(upd);
  }

  /**
   * Find or Create User
   * @param k
   * @param v
   * @param {object} [uo = {}]
   * @returns {Promise<{session_object: {_attributes: {}}, _attributes: {}}|User|*|boolean|{error: string}|User>}
   */
  static async findOrCreateByAttribute(
    k: string,
    v: any,
    uo: any = {}
  ): Promise<User | false | ErrorMessage> {
    const u = await User.findOne({ _attributes: { json: [k, v] } });
    if (u && u.disabled) return false;
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
        return await User.create({ ...uo, _attributes: { [k]: v } });
      }
    }
  }

  /**
   * Create user
   * @param uo - user object
   * @returns {Promise<{error: string}|User>}
   */
  static async create(uo: GenObj): Promise<User | ErrorMessage> {
    const { email, password, passwordRepeat, role_id, ...rest } = uo;
    const hasPw = typeof password !== "undefined";
    const u = new User({ email, password, role_id });
    if (hasPw && User.unacceptable_password_reason(u.password))
      return {
        error:
          "Password not accepted: " +
          User.unacceptable_password_reason(u.password),
      };
    const hashpw = hasPw ? await User.hashPassword(u.password) : "";
    const user_table = User.table;

    if (await User.matches_existing_user(uo))
      return { error: `This user already exists` };

    const urecord = {
      email: u.email,
      password: hashpw,
      role_id: u.role_id,
      ...rest,
    };
    let constraint_check_error = user_table.check_table_constraints(urecord);
    if (constraint_check_error) return { error: constraint_check_error };
    const valResCollector: any = {};
    await Trigger.runTableTriggers(
      "Validate",
      user_table,
      { ...urecord },
      valResCollector
    );
    if ("error" in valResCollector)
      return { error: valResCollector.error as string };
    if ("set_fields" in valResCollector)
      Object.assign(urecord, valResCollector.set_fields);

    u.id = await db.insert("users", urecord);
    await Trigger.runTableTriggers("Insert", user_table, u);
    return u;
  }

  static async matches_existing_user(uo: any): Promise<boolean> {
    const existingCondition: any = [];
    for (const field of User.table.fields.filter((f) => f.is_unique))
      if (uo[field.name])
        existingCondition.push({ [field.name]: uo[field.name] });

    if (existingCondition.length) {
      const ex = await User.findOne({ or: existingCondition });
      if (ex) return true;
    }
    return false;
  }

  /**
   * Create session object for user
   * @type {{role_id: number, language, id, email, tenant: *}}
   */
  get session_object(): any {
    const so = {
      email: this.email,
      id: this.id,
      role_id: this.role_id,
      language: this.language,
      tenant: db.getTenantSchema(),
    };
    Object.assign(so, safeUserFields(this));
    return so;
  }

  static get table(): Table {
    return Table.findOne({ name: "users" }) as Table;
  }

  /**
   * Authenticate User
   * @param uo - user object
   * @returns {Promise<boolean|User>}
   */
  static async authenticate(uo: any): Promise<User | false> {
    const { password, ...uoSearch } = uo;
    const urow = await User.findForSession(uoSearch);
    if (!urow) return false;
    if (urow.disabled) return false;
    const cmp = urow.checkPassword(password || "");
    if (cmp) return new User(urow);
    else return false;
  }

  /**
   * Find users list
   * @param where - where object
   * @returns {Promise<User[]>}
   */
  static async findForSession(where: Where): Promise<User | false> {
    //get join fields in all ownership formulae
    const { getState } = require("../db/state");
    const { freeVariables } = require("./expression");
    const Field = require("./field");
    const { add_free_variables_to_joinfields } = require("../plugin-helper");
    let freeVars = new Set();
    for (const table of getState().tables)
      if (table.ownership_formula)
        freeVars = new Set([
          ...freeVars,
          ...freeVariables(table.ownership_formula),
        ]);
    const freeUserVars = [...freeVars]
      .map((fv: any) => {
        const [kpath0, ...rest] = fv.split(".");
        if (kpath0 === "user" && rest.length > 0) return rest.join(".");
        else return null;
      })
      .filter((s) => s);

    const user_table = Table.findOne({ name: "users" });
    const fields = await user_table?.getFields();

    const joinFields = {};
    add_free_variables_to_joinfields(new Set(freeUserVars), joinFields, fields);

    for (const wk of Object.keys(where)) {
      const field = fields?.find((f) => f.name === wk);
      if (!field) delete where[wk];
    }

    const us = await user_table!.getJoinedRows({
      where,
      limit: 2,
      joinFields,
      starFields: true,
    });
    if (us.length !== 1) return false;
    const newUser = new User(us[0] as UserCfg);

    //child fields

    //user.usergroups_by_user.map(g=>g.group).includes(group)
    const cfields = await Field.find(
      { reftable_name: "users" },
      { cached: true }
    );

    for (const cfield of cfields) {
      const table = Table.findOne(cfield.table_id) as Table;
      const fv = freeUserVars.find((fuv) =>
        fuv.startsWith(`${table!.name}_by_${cfield.name}`)
      );
      if (fv) {
        newUser[`${table!.name}_by_${cfield.name}`] = await table.getRows({
          [cfield.name]: newUser.id,
        });
      }
    }
    return newUser;
  }

  /**
   * Find users list
   * @param where - where object
   * @param selectopts - select options
   * @returns {Promise<User[]>}
   */
  static async find(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<Array<User>> {
    const us = await db.select("users", where, selectopts);
    return us.map((u: UserCfg) => new User(u));
  }

  /**
   * Find one user
   * @param where - where object
   * @returns {Promise<User|*>}
   */
  static async findOne(where: Where): Promise<User | undefined> {
    const u = await db.selectMaybeOne("users", where);
    return u ? new User(u) : u;
  }

  /**
   * Check that user table is not empty in database
   * @deprecated use method count()
   * @returns {Promise<boolean>} true if there are users in db
   */
  static async nonEmpty(): Promise<boolean> {
    const res = await db.count("users");
    return res > 0;
  }

  /**
   * Delete user based on session object
   * @returns {Promise<void>}
   */
  async delete(): Promise<void> {
    const schema = db.getTenantSchemaPrefix();
    await this.destroy_sessions();
    await db.query(`delete FROM ${schema}users WHERE id = $1`, [this.id]);
    await Trigger.runTableTriggers(
      "Delete",
      Table.findOne({ name: "users" }) as Table,
      this
    );
  }

  /**
   * Set language for User in database
   * @param language
   * @returns {Promise<void>}
   */
  async set_language(language: string): Promise<void> {
    await this.update({ language });
  }

  /**
   * Update User
   * @param row
   * @returns {Promise<void>}
   */
  async update(row: Row): Promise<void> {
    await User.table.updateRow(row, this.id!);
    Object.assign(this, row);
  }

  /**
   * Get new reset token
   * @returns {Promise<*|string>}
   */
  async getNewResetToken(): Promise<string> {
    const reset_password_token_uuid = uuidv4();
    const reset_password_expiry = new Date();
    reset_password_expiry.setDate(new Date().getDate() + 1);
    const reset_password_token = await hash(reset_password_token_uuid, 10);
    await this.update({ reset_password_token, reset_password_expiry });
    return reset_password_token_uuid;
  }

  /**
   * Add new API token to user
   * @returns {Promise<string>}
   */
  async getNewAPIToken(): Promise<string> {
    const api_token = uuidv4();
    await this.update({ api_token });
    this.api_token = api_token;
    return api_token;
  }

  /**
   * Remove API token for user
   * @returns {Promise<string>}
   */
  async removeAPIToken(): Promise<null> {
    const api_token = null;
    await this.update({ api_token });
    this.api_token = api_token;
    return api_token;
  }

  /**
   * Validate password
   * @param pw
   * @returns {string}
   */
  static unacceptable_password_reason(pw: string): string | undefined {
    if (pw.length < 8) return "Password too short";
    if (check(pw)) return "Password too common";
  }

  /**
   * Validate email
   * @param email
   * @returns {boolean}
   */
  // TBD that validation works
  static valid_email(email: string): boolean {
    return validate(email);
  }

  /**
   * Verification with token
   * @param email - email string
   * @param verification_token - verification token string
   * @returns {Promise<{error: string}|boolean>} true if verification passed, error string if not
   */
  static async verifyWithToken({
    email,
    verification_token,
  }: {
    email: string;
    verification_token: string;
  }): Promise<true | ErrorMessage> {
    if (verification_token.length < 10 || !email)
      return { error: "Invalid token" };
    const u = await User.findOne({ email, verification_token });
    if (!u) return { error: "Invalid token" };
    return await u.set_to_verified();
  }

  /**
   * @returns {Promise<boolean>}
   */
  async set_to_verified(): Promise<true> {
    const upd: GenObj = { verified_on: new Date() };
    const { getState } = require("../db/state");

    const elevate_verified = +getState().getConfig("elevate_verified");
    if (elevate_verified)
      upd.role_id = Math.min(elevate_verified, this.role_id);
    await this.update(upd);
    Object.assign(this, upd);
    const Trigger = require("./trigger");
    Trigger.emitEvent("UserVerified", null, this, this);
    return true;
  }

  /**
   * Reset password using token
   * @param email - email address string
   * @param reset_password_token - reset password token string
   * @param password
   * @returns {Promise<{error: string}|{success: boolean}>}
   */
  static async resetPasswordWithToken({
    email,
    reset_password_token,
    password,
  }: {
    email: string;
    reset_password_token: string;
    password: string;
  }): Promise<SuccessMessage | ErrorMessage> {
    if (reset_password_token.length < 10)
      return {
        error: "Invalid token or invalid token length or incorrect email",
      };
    const u = await User.findOne({ email });
    if (
      u &&
      u.reset_password_expiry &&
      new Date() < u.reset_password_expiry &&
      u.reset_password_token
    ) {
      const match = compareSync(reset_password_token, u.reset_password_token);
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

  /**
   * Count users in database
   * @param where
   * @returns {Promise<number>}
   */
  // TBD I think that method is simular to notEmppty() but more powerfull.
  // TBD use some rules for naming of methods - e.g. this method will have name count_users or countUsers because of methods relay on roles in this class
  static async count(where?: Where): Promise<number> {
    return await db.count("users", where || {});
  }

  /**
   * Get available roles
   * @returns {Promise<*>}
   */
  static async get_roles(): Promise<Row[] | undefined> {
    return await db.select("_sc_roles", {}, { orderBy: "id" });
  }

  /**
   * Generate password
   * @returns {string}
   */
  static generate_password(): string {
    const candidate = generateString().split(" ").join("");
    // TBD low performance impact - un
    if (candidate.length < 10) return User.generate_password();
    else return candidate;
  }

  /**
   * @returns {Promise<void>}
   */
  async destroy_sessions(): Promise<void> {
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

  /**
   * @param {object} req
   */
  relogin(req: NonNullable<any>): Promise<void> {
    return new Promise((resolve, reject) => {
      req.login(this.session_object, function (err: any) {
        if (err) req.flash("danger", err);
        resolve();
      });
    });
  }

  /**
   * update 'last_mobile_login' columnwill
   * @param date new login_date or null for logout (invalidates all jwts)
   */
  async updateLastMobileLogin(date: Date | null): Promise<void> {
    const dateVal = !date
      ? date
      : db.isSQLite
      ? date.valueOf()
      : date.toISOString();
    await this.update({ last_mobile_login: dateVal });
  }
}

namespace User {
  export type UserCfg = {
    id?: number | string;
    email: string;
    password: string;
    disabled?: boolean;
    language?: string;
    _attributes?: string | any;
    api_token?: string;
    verification_token?: string;
    verified_on?: Date | number | string;
    role_id?: number | string;
    reset_password_token?: string; // 10 chars length
    reset_password_expiry?: Date | number | string;
    last_mobile_login?: Date | number | string;
    [key: string]: any;
  };
}
type UserCfg = User.UserCfg;

export = User;
