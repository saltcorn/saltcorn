import db from "@saltcorn/data/db/index";
const { getState } = require("@saltcorn/data/db/state");
getState().registerPlugin("base", require("@saltcorn/data/base-plugin"));
import backup from "../models/backup";
const { create_backup, restore } = backup;
const reset = require("@saltcorn/data/db/reset_schema");
import { unlink } from "fs/promises";
import Table from "@saltcorn/data/models/table";
import View from "@saltcorn/data/models/view";
import User from "@saltcorn/data/models/user";
import config from "@saltcorn/data/models/config";
const { setConfig, getConfig } = config;
import Trigger from "@saltcorn/data/models/trigger";
import Library from "@saltcorn/data/models/library";
import Role from "@saltcorn/data/models/role";

import {
  assertIsSet,
  assertsObjectIsUser,
} from "@saltcorn/data/tests/assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

afterAll(db.close);

beforeAll(async () => {
  await require("@saltcorn/data/db/reset_schema")();
  await require("@saltcorn/data/db/fixtures")();
});

describe("Backup and restore", () => {
  it("should create and restore backup", async () => {
    await setConfig("site_name", "backups rule!");
    await setConfig("menu_items", [
      {
        type: "Page",
        label: "a_page",
        min_role: 10,
        pagename: "a_page",
      },
      {
        url: "https://www.bbc.co.uk/news",
        icon: "undefined",
        text: "BBC",
        type: "Link",
        label: "BBC",
        style: "",
        location: "Standard",
        min_role: 10,
      },
    ]);
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
    const menus0 = await getConfig("menu_items", []);
    expect(menus0.length).toBe(0);
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
    const menus = await getConfig("menu_items");
    expect(menus.length).toBe(2);
    expect(menus[0].type).toBe("Page");
    expect(menus[0].pagename).toBe("a_page");
    expect(menus[1].type).toBe("Link");
    expect(menus[1].url).toBe("https://www.bbc.co.uk/news");

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
