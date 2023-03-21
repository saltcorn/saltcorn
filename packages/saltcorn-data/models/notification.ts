/**
 * Notification Database Access Layer
 * @category saltcorn-data
 * @module models/notification
 * @subcategory models
 */
import db from "../db";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";

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

  static async create(notin: NotificationCfg): Promise<void> {
    const o = new Notification(notin);
    await db.insert("_sc_notifications", {
      created: o.created,
      title: o.title,
      body: o.body,
      link: o.link,
      user_id: o.user_id,
      read: o.read,
    });
  }

  async mark_as_read(): Promise<void> {
    await db.update("_sc_notifications", { read: true }, this.id);
  }

  static async mark_as_read(where: Where): Promise<void> {
    await db.updateWhere("_sc_notifications", { read: true }, where);
  }
  static async count(where: Where): Promise<number> {
    return await db.count("_sc_notifications", where);
  }
}

type NotificationCfg = {
  id?: number;
  created?: Date;
  title: string;
  body?: string;
  link?: string;
  user_id: number;
  read?: boolean;
};

export = Notification;
