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
    this.reset_password_expiry =
      (typeof o.reset_password_expiry === "string" &&
        o.reset_password_expiry.length > 0) ||
      typeof o.reset_password_expiry === "number"
        ? new Date(o.reset_password_expiry)
        : o.reset_password_expiry instanceof Date
        ? o.reset_password_expiry
        : null;
    this.role_id = o.role_id ? +o.role_id : 8;
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
    await db.update("users", upd, this.id);
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
        const extra: GenObj = {};
        if (!uo.password) extra.password = User.generate_password();
        return await User.create({ ...uo, ...extra, _attributes: { [k]: v } });
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
    Trigger.runTableTriggers(
      "Insert",
      Table.findOne({ name: "users" }) as Table,
      u
    );
    return u;
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

  /**
   * Authenticate User
   * @param uo - user object
   * @returns {Promise<boolean|User>}
   */
  static async authenticate(uo: any): Promise<User | false> {
    const { password, ...uoSearch } = uo;
    const urows = await User.find(uoSearch, { limit: 2 });
    if (urows.length !== 1) return false;
    const [urow] = urows;
    if (urow.disabled) return false;
    const cmp = urow.checkPassword(password || "");
    if (cmp) return new User(urow);
    else return false;
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
    this.destroy_sessions();
    await db.query(`delete FROM ${schema}users WHERE id = $1`, [this.id]);
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
    await db.update("users", row, this.id);
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
    await db.update(
      "users",
      { reset_password_token, reset_password_expiry },
      this.id
    );
    return reset_password_token_uuid;
  }

  /**
   * Add new API token to user
   * @returns {Promise<string>}
   */
  async getNewAPIToken(): Promise<string> {
    const api_token = uuidv4();
    await db.update("users", { api_token }, this.id);
    this.api_token = api_token;
    return api_token;
  }

  /**
   * Remove API token for user
   * @returns {Promise<string>}
   */
  async removeAPIToken(): Promise<null> {
    const api_token = null;
    await db.update("users", { api_token }, this.id);
    this.api_token = api_token;
    return api_token;
  }

  /**
   * Validate password
   * @param pw
   * @returns {string}
   */
  static unacceptable_password_reason(pw: string): string | undefined {
    if (typeof pw !== "string") return "Not a string";
    if (pw.length < 8) return "Too short";
    if (check(pw)) return "Too common";
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
   * @param email - email sting
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
    if (
      typeof verification_token !== "string" ||
      typeof email !== "string" ||
      verification_token.length < 10 ||
      !email
    )
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
    await db.update("users", upd, this.id);
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
    if (
      typeof reset_password_token !== "string" ||
      typeof email !== "string" ||
      reset_password_token.length < 10
    )
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
  static async get_roles(): Promise<string[]> {
    const rs = await db.select("_sc_roles", {}, { orderBy: "id" });
    return rs;
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
  relogin(req: NonNullable<any>): void {
    req.login(this.session_object, function (err: any) {
      if (err) req.flash("danger", err);
    });
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
    [key: string]: any;
  };
}
type UserCfg = User.UserCfg;

export = User;
