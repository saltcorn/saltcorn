const db = require("../db");
const moment = require("moment");

const { contract, is } = require("contractis");

class EventLog {
  constructor(o) {
    this.id = o.id;
    this.event_type = o.event_type;
    this.channel = o.channel;
    this.occur_at = ["string", "number"].includes(typeof o.occur_at)
      ? new Date(o.occur_at)
      : o.occur_at;
    this.user_id = o.user_id;
    this.payload =
      typeof o.payload === "string" ? JSON.parse(o.payload) : o.payload;
    contract.class(this);
  }
  static async find(where, selopts) {
    const us = await db.select("_sc_event_log", where, selopts);
    return us.map((u) => new EventLog(u));
  }
  static async findOne(where) {
    const u = await db.selectOne("_sc_event_log", where);
    return new EventLog(u);
  }

  static async count(where) {
    return await db.count("_sc_event_log", where || {});
  }
  get reltime() {
    return moment(this.occur_at).fromNow();
  }
  static async create(o) {
    const { getState } = require("../db/state");

    const settings = getState().getConfig("event_log_settings", {});
    if (!settings[o.event_type]) return;
    const ev = new EventLog(o);
    const { id, ...rest } = ev;

    ev.id = await db.insert("_sc_event_log", rest);
    return ev;
  }
}

EventLog.contract = {
  variables: {
    id: is.maybe(is.posint),
    event_type: is.str,
    channel: is.maybe(is.str),
    occur_at: is.class("Date"),
    user_id: is.maybe(is.posint),
    payload: is.maybe(is.obj()),
  },
  methods: {},
  static_methods: {
    find: is.fun(is.obj(), is.promise(is.array(is.class("EventLog")))),
    findOne: is.fun(is.obj(), is.promise(is.class("EventLog"))),
    create: is.fun(is.obj(), is.promise(is.any)),
  },
};

module.exports = EventLog;
