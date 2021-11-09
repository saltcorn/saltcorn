/**
 * Crash Database Access Layer
 * @category saltcorn-data
 * @module models/crash
 * @subcategory models
 */
const db = require("../db");
const moment = require("moment");
const { contract, is } = require("contractis");

/**
 * Crash Class
 * @category saltcorn-data
 */
class Crash {
  /**
    * Crash constructor
    * @param {object} o
    */
  constructor(o) {
    this.id = o.id;
    this.stack = o.stack;
    this.message = o.message;
    this.occur_at = ["string", "number"].includes(typeof o.occur_at)
      ? new Date(o.occur_at)
      : o.occur_at;
    this.tenant = o.tenant;
    this.user_id = o.user_id;
    this.body = o.body;
    this.url = o.url;
    this.headers =
      typeof o.headers === "string" ? JSON.parse(o.headers) : o.headers;
    contract.class(this);
  }

  /**
   * @param {object} where 
   * @param {object} selopts 
   * @returns {Promise<Crash[]>}
   */
  static async find(where, selopts) {
    const us = await db.select("_sc_errors", where, selopts);
    return us.map((u) => new Crash(u));
  }

  /**
   * @param {object} where 
   * @returns {Promise<Crash>}
   */
  static async findOne(where) {
    const u = await db.selectOne("_sc_errors", where);
    return new Crash(u);
  }

  /**
   * @type {string}
   */
  get reltime() {
    return moment(this.occur_at).fromNow();
  }

  /**
   * @param {object} where 
   * @returns {Promise<number>}
   */
  static async count(where) {
    return await db.count("_sc_errors", where || {});
  }

  /**
   * @type {string}
   */
  get msg_short() {
    return this.message.length > 90
      ? this.message.substring(0, 90)
      : this.message;
  }

  /**
   * @param {object} err 
   * @param {object} [req = {}]
   * @returns {Promise<void>}
   */
  static async create(err, req = {}) {
    const schema = db.getTenantSchema();
    const payload = {
      stack: err.stack,
      message: err.message,
      occur_at: new Date(),
      tenant: schema,
      user_id: req.user ? req.user.id : null,
      body: req.body ? { body: req.body } : null,
      url: req.url,
      headers: req.headers,
    };
    await db.runWithTenant(db.connectObj.default_schema, async () => {
      await db.insert("_sc_errors", payload);
    });
    const Trigger = require("./trigger");

    Trigger.emitEvent("Error", null, req.user, payload);
  }
}

Crash.contract = {
  variables: {
    id: is.maybe(is.posint),
    user_id: is.maybe(is.posint),
    stack: is.str,
    message: is.str,
    tenant: is.str,
    url: is.str,
    occur_at: is.class("Date"),
    headers: is.obj(),
  },
  methods: {
    reltime: is.getter(is.str),
  },
  static_methods: {
    find: is.fun(is.obj(), is.promise(is.array(is.class("Crash")))),
    findOne: is.fun(is.obj(), is.promise(is.class("Crash"))),
    create: is.fun([is.obj(), is.obj()], is.promise(is.any)),
  },
};

module.exports = Crash;
