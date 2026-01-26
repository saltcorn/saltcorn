/**
 * Notification Database Access Layer
 * @category saltcorn-data
 * @module models/notification
 * @subcategory models
 */
import db from "../db";
import type {
  Where,
  SelectOptions,
  Row,
  PartialSome,
} from "@saltcorn/db-common/internal";
import User from "./user";
import state from "../db/state";
import { PushMessageHelper } from "./internal/push_message_helper";
import utils from "../utils";
import { MailQueue } from "./internal/mail_queue";

const { getState } = state;
const { isPushEnabled } = utils;

/**
 * Notification Class
 * @category saltcorn-data
 */

class Notification {
  id?: number;
  created: Date;
  title: string;
  body?: string;
  link?: string;
  user_id: number;
  read: boolean;
  send_status?: "pending" | "sent";

  /**
   * Notification constructor
   * @param {object} o
   */
  constructor(o: NotificationCfg | Notification) {
    this.id = o.id;
    this.created = o.created || new Date();
    this.title = o.title;
    this.body = o.body;
    this.link = o.link;
    this.user_id = o.user_id;
    this.read = !!o.read;
    this.send_status = o.send_status;
  }
  /**
   * @param {*} where
   * @param {*} selectopts
   * @returns {Notificatio[]}
   */
  static async find(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<Notification[]> {
    const us = await db.select("_sc_notifications", where, selectopts);
    return us.map((u: any) => new Notification(u));
  }

  /**
   * @param {*} where
   * @returns {Notification}
   */
  static async findOne(where: Where): Promise<Notification> {
    const u = await db.selectMaybeOne("_sc_notifications", where);
    return u ? new Notification(u) : u;
  }

  static async create(notin: NotificationCfg): Promise<Notification> {
    const o = new Notification(notin);
    const id = await db.insert("_sc_notifications", {
      created: o.created,
      title: o.title,
      body: o.body,
      link: o.link,
      user_id: o.user_id,
      read: o.read,
      send_status: null,
    });
    o.id = id;
    const state = getState();
    const user = await User.findOne({ id: o.user_id });
    if (user?._attributes?.notify_email) {
      await MailQueue.handleNotification(o, user);
    }
    const enable_dynamic_updates = state?.getConfig("enable_dynamic_updates");
    if (enable_dynamic_updates && user?.id) {
      state?.emitDynamicUpdate(
        db.getTenantSchema(),
        {
          toast_title: o.title,
          remove_delay: 5,
          notify: `<div>${o.body}</div>
          ${o.link ? `<a href="${o.link}">${o.link}</a>` : ""}`,
          eval_js: "check_saltcorn_notifications()",
        },
        [user.id]
      );
    }
    if (isPushEnabled(user) && state?.pushHelper)
      state.pushHelper.pushNotification(o);
    return o;
  }

  async mark_as_read(): Promise<void> {
    await db.update("_sc_notifications", { read: true }, this.id);
  }

  static async mark_as_read(where: Where): Promise<void> {
    await db.updateWhere("_sc_notifications", { read: true }, where);
  }

  async delete(): Promise<void> {
    await db.deleteWhere("_sc_notifications", { id: this.id });
  }

  static async deleteRead(user_id: number): Promise<void> {
    await db.deleteWhere("_sc_notifications", { user_id, read: true });
  }

  static async count(where: Where): Promise<number> {
    return await db.count("_sc_notifications", where);
  }
}

type NotificationCfg = PartialSome<Notification, "title" | "user_id">;

export = Notification;
