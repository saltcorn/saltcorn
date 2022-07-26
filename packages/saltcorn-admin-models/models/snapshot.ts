const { getState } = require("@saltcorn/data/db/state");
import db from "@saltcorn/data/db/index";
import pack from "./pack";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";

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

type SnapshotCfg = {
  id?: number;
  created: Date;
  pack: object;
  hash: string;
};

class Snapshot {
  id?: number;
  created: Date;
  pack: object;
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
}

export = Snapshot;
