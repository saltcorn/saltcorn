import db from "@saltcorn/data/db/index";
import pack from "./pack";
import type { Where, SelectOptions } from "@saltcorn/db-common/internal";

const {
  table_pack,
  view_pack,
  plugin_pack,
  page_pack,
  install_pack,
  can_install_pack,
} = pack;
import backup from "./backup";
const crypto = require("crypto");
import { isEqual } from "lodash";
import View from "@saltcorn/data/models/view";
import { Pack } from "@saltcorn/types/base_types";
import Page from "@saltcorn/data/models/page";
import Table from "@saltcorn/data/models/table";

type SnapshotCfg = {
  id?: number;
  created: Date;
  pack: Pack;
  hash: string;
};

class Snapshot {
  id?: number;
  created: Date;
  pack: Pack;
  hash: string;

  /**
   * Library constructor
   * @param {object} o
   */
  constructor(o: SnapshotCfg | Snapshot) {
    this.id = o.id;
    this.created = o.created;
    this.pack = o.pack;
    this.hash = o.hash;
  }

  static async find(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<Snapshot[]> {
    const us = await db.select("_sc_snapshots", where, selectopts);
    return us.map((u: any) => new Snapshot(u));
  }
  static async findOne(where: Where): Promise<Snapshot | null> {
    const us = await db.select("_sc_snapshots", where, { limit: 1 });
    if (us.length === 0) return null;
    else return new Snapshot(us[0]);
  }

  static async latest(): Promise<Snapshot | null> {
    const sns = await Snapshot.find(
      {},
      { orderBy: "created", orderDesc: true, limit: 1 }
    );
    if (sns.length === 0) return null;
    else return sns[0];
  }

  static async take_if_changed(): Promise<boolean> {
    const latest = await Snapshot.latest();

    const current_pack = await backup.create_pack_json();

    //comparing objects is not accurate (too many false positives) so we hash instead
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(current_pack))
      .digest("hex")
      .slice(0, 40);

    if (!latest || latest.hash !== hash) {
      await db.insert("_sc_snapshots", {
        created: new Date(),
        pack: current_pack,
        hash,
      });
      return true;
    } else {
      return false;
    }
  }

  async restore_entity(type: string, name: string): Promise<undefined> {
    if (type === "View") {
      const { table, on_menu, menu_label, on_root_page, ...viewNoTable } =
        this.pack.views.find((v: any) => v.name === name) as any;
      const view = await View.findOne({ name });
      if (view) await View.update(viewNoTable, view.id!);
    }
    if (type === "page") {
      const { root_page_for_roles, menu_label, ...pageSpec } =
        this.pack.pages.find((p: any) => p.name === name) as any;
      const page = await Page.findOne({ name });
      if (page) await Page.update(page.id!, pageSpec!);
    }
    return;
  }
  static async entity_history(type: string, name: string): Promise<Snapshot[]> {
    const snaps = await Snapshot.find(
      {},
      { orderBy: "created", orderDesc: true }
    );
    if (snaps.length === 0) return [];
    const get_entity = (pack: any) => {
      switch (type) {
        case "view":
          return pack.views.find((v: any) => v.name === name);
        case "page":
          return pack.pages.find((p: any) => p.name === name);
      }
    };
    let last = get_entity(snaps[0].pack);

    const history = last ? [snaps[0]] : [];
    for (const snap of snaps) {
      const current = get_entity(snap.pack);
      if (!isEqual(last, current)) {
        history.push(snap);
        last = current;
      }
    }

    return history;
  }
}

export = Snapshot;
