import db from "../db";
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
import backup from "../models/backup";
const { create_backup, restore } = backup;
const reset = require("../db/reset_schema");
import { unlink } from "fs/promises";
import Table from "../models/table";
import View from "../models/view";
import User from "../models/user";
import config from "../models/config";
const { setConfig, getConfig } = config;
import Trigger from "../models/trigger";
import Library from "../models/library";
import Role from "../models/role";

import { assertIsSet, assertsObjectIsUser } from "./assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

afterAll(db.close);

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

describe("Backup and restore", () => {
  it("should create and restore backup", async () => {
    await setConfig("site_name", "backups rule!");
    const sn1 = await getConfig("site_name");
    expect(sn1).toBe("backups rule!");
    await Role.create({ role: "paid", id: 6 });
    await Table.create("myblanktable", { min_role_read: 6 });
    await Trigger.create({
      name: "footrig",
      table_id: 1,
      when_trigger: "Insert",
      action: "run_js_code",
      configuration: { code: "console.log('new user')" },
    });
    await Trigger.create({
      name: "hourtrig",
      when_trigger: "Hourly",
      action: "run_js_code",
      configuration: { code: "console.log('cuckoo')" },
    });
    await Library.create({
      name: "foo",
      icon: "fa-bar",
      layout: { baz: "bar" },
    });

    const fnm = await create_backup();
    const t1 = await Table.findOne({ name: "books" });
    assertIsSet(t1);
    const t1c = await t1.countRows();
    const v1 = await View.find();
    expect(!!t1).toBe(true);

    await reset();
    const admu = await User.create({
      email: "admin@foo.com",
      password: "AhGGr6rhu45",
      role_id: 1,
    });
    assertsObjectIsUser(admu);
    expect(typeof admu.password).toBe("string");

    const t2 = await Table.findOne({ name: "books" });
    expect(t2).toBe(null);
    const sn0 = await getConfig("site_name");
    expect(sn0).toBe("Saltcorn");
    const restore_res = await restore(fnm, (p) => {});
    await unlink(fnm);
    expect(restore_res).toBe(undefined);
    const t3 = await Table.findOne({ name: "books" });
    assertIsSet(t3);
    expect(!!t3).toBe(true);
    const t5 = await Table.findOne({ name: "myblanktable" });
    assertIsSet(t5);
    expect(!!t5).toBe(true);
    expect(t5.min_role_read).toBe(6);
    const t3c = await t3.countRows();
    expect(t1c).toBe(t3c);
    const v2 = await View.find();
    expect(v1.length).toBe(v2.length);
    const sn = await getConfig("site_name");
    expect(sn).toBe("backups rule!");
    await t3.insertRow({ author: "Marcus Rediker", pages: 224 });
    const staff = await User.findOne({ email: "staff@foo.com" });
    expect(!!staff).toBe(true);
    assertsObjectIsUser(staff);
    expect(typeof staff.password).toBe("string");
    const trig = await Trigger.findOne({ name: "footrig" });
    expect(!!trig).toBe(true);
    const htrig = await Trigger.findOne({ name: "hourtrig" });
    expect(!!htrig).toBe(true);
    const lib = await Library.findOne({ name: "foo" });
    expect(!!lib).toBe(true);

    expect(staff.checkPassword("ghrarhr54hg")).toBe(true);
  });
});
