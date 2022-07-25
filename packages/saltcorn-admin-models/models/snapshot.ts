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

type SnapshotCfg = {
  id?: number;
  created: Date;
  pack: object;
};

class Snapshot {
  id?: number;
  created: Date;
  pack: object;

  /**
   * Library constructor
   * @param {object} o
   */
  constructor(o: SnapshotCfg | Snapshot) {
    this.id = o.id;
    this.created = o.created;
    this.pack = o.pack;
  }

  static async find(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<Snapshot[]> {
    const us = await db.select("_sc_snapshots", where, selectopts);
    return us.map((u: any) => new Snapshot(u));
  }
}

export = Snapshot;
