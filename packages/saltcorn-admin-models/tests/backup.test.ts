import db from "@saltcorn/data/db/index";
import { getState } from "@saltcorn/data/db/state";
import basePlugin from "@saltcorn/data/base-plugin";
getState()!.registerPlugin("base", basePlugin);
import backup from "../models/backup.js";
const { create_backup, restore, auto_backup_now } = backup;
import reset from "@saltcorn/data/db/reset_schema";
import fixtures from "@saltcorn/data/db/fixtures";
import { unlink, mkdtemp, writeFile, readdir, rm } from "fs/promises";
import { join } from "path";
import Table from "@saltcorn/data/models/table";
import View from "@saltcorn/data/models/view";
import User from "@saltcorn/data/models/user";
import * as config from "@saltcorn/data/models/config";
const { setConfig, getConfig } = config;
import Trigger from "@saltcorn/data/models/trigger";
import Library from "@saltcorn/data/models/library";
import MetaData from "@saltcorn/data/models/metadata";
import Role from "@saltcorn/data/models/role";
import WorkflowStep from "@saltcorn/data/models/workflow_step";

import {
  assertIsSet,
  assertsObjectIsUser,
} from "@saltcorn/data/tests/assertions";
import {
  afterAll,
  describe,
  it,
  expect,
  beforeAll,
  jest,
} from "@saltcorn/db-common/test_expect";
import Field from "@saltcorn/data/models/field";
import File from "@saltcorn/data/models/file";
import Zip from "adm-zip";
import * as mocks from "@saltcorn/data/tests/mocks";
const { mockReqRes, plugin_with_routes } = mocks;

afterAll(db.close);

beforeAll(async () => {
  await reset();
  await fixtures();
  getState()!.registerPlugin("mock_plugin", plugin_with_routes());
});
jest.setTimeout(30000);

describe("Backup and restore", () => {
  it("should create and restore backup", async () => {
    await setConfig("site_name", "backups rule!");
    await setConfig("menu_items", [
      {
        type: "Page",
        label: "a_page",
        min_role: 100,
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
        min_role: 100,
      },
    ]);
    const sn1 = await getConfig("site_name");
    expect(sn1).toBe("backups rule!");
    await Role.create({ role: "paid", id: 60 });
    await Table.create("myblanktable", { min_role_read: 60 });
    const vtbl = await Table.create("myversionedtable", {
      min_role_read: 80,
      versioned: true,
    });
    await Field.create({
      name: "name",
      type: "String",
      table: vtbl,
    });
    await vtbl.insertRow({ name: "Fred" });
    await vtbl.updateRow({ name: "Sam" }, 1);
    await vtbl.insertRow({ name: 'My \nSp\\ecial "Friend"' });

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
    const trigger = await Trigger.create({
      action: "Workflow",
      when_trigger: "Never",
      name: "mywf",
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "first_step",
      next_step: "second_step",
      action_name: "run_js_code",
      initial_step: true,
      configuration: { code: `return {x:1}` },
    });
    await WorkflowStep.create({
      trigger_id: trigger.id!,
      name: "second_step",
      next_step: "third_step",
      action_name: "run_js_code",
      initial_step: false,
      configuration: { code: `return {y:x+1}` },
    });

    await Library.create({
      name: "foo",
      icon: "fa-bar",
      layout: { baz: "bar" },
    });
    await MetaData.create({
      type: "PromptSummary",
      name: "View45",
      user_id: 1,
      written_at: new Date(),
      body: { foo: { bar: 1 }, baz: 7 },
    });
    await Table.create("JoeTable", {
      provider_name: "provtab",
      provider_cfg: { middle_name: "Robinette" },
    });

    await User.table.update({
      min_role_read: 40,
      description: "Users are the best",
    });
    await getState()!.refresh_tables();

    const fnm = await create_backup();
    const t1 = Table.findOne({ name: "books" });
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
    expect(User.table.min_role_read).toBe(1);

    const t2 = Table.findOne({ name: "books" });
    expect(t2).toBe(null);
    const sn0 = await getConfig("site_name");
    expect(sn0).toBe("Saltcorn");
    const menus0 = await getConfig("menu_items", []);
    expect(menus0.length).toBe(7); // newly liberated menu items

    //restore
    const restore_res = await restore(fnm, (p) => {});
    await unlink(fnm);
    expect(restore_res).toBe(undefined);

    const t3 = Table.findOne({ name: "books" });
    assertIsSet(t3);
    expect(!!t3).toBe(true);
    const t5 = Table.findOne({ name: "myblanktable" });
    assertIsSet(t5);
    const t6 = Table.findOne({ name: "myversionedtable" });
    assertIsSet(t6);
    const vhist = await t6.get_history();
    expect(vhist.length).toBe(3);
    const t6row = await t6.getRow({ id: 2 });
    assertIsSet(t6row);
    expect(t6row.name).toBe('My \nSp\\ecial "Friend"');

    expect(!!t5).toBe(true);
    expect(t5.min_role_read).toBe(60);
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
    expect(typeof staff!.password).toBe("string");
    const trig = await Trigger.findOne({ name: "footrig" });
    expect(!!trig).toBe(true);
    const htrig = await Trigger.findOne({ name: "hourtrig" });
    expect(!!htrig).toBe(true);
    const mywf = await Trigger.findOne({ name: "mywf" });
    expect(!!mywf).toBe(true);
    const mySteps = await WorkflowStep.find({ trigger_id: mywf!.id! });
    expect(mySteps.length).toBe(2);
    const lib = await Library.findOne({ name: "foo" });
    expect(!!lib).toBe(true);
    const md = await MetaData.findOne({ type: "PromptSummary" });
    expect(!!md).toBe(true);
    expect(md.body.foo.bar).toBe(1);

    const tp = Table.findOne({ name: "JoeTable" });
    expect(tp?.provider_name).toBe("provtab");
    expect(tp?.provider_cfg?.middle_name).toBe("Robinette");

    expect(staff!.checkPassword("ghrarhr54hg")).toBe(true);
    expect(User.table.min_role_read).toBe(40);
    expect(User.table.description).toBe("Users are the best");
  });
});

describe("auto backup retention to local directory", () => {
  it("deletes backups not retained by the tiered policy", async () => {
    // in cwd rather than tmpdir: auto_backup_now renames the zip into the
    // directory, and rename fails across filesystems
    const dir = await mkdtemp(join(process.cwd(), "sc-backup-retention-"));
    const prefix = getState()!.getConfig("backup_file_prefix");
    await getState()!.setConfig("site_name", "RetTest");
    await getState()!.setConfig("auto_backup_destination", "Local directory");
    await getState()!.setConfig("auto_backup_directory", dir);
    await getState()!.setConfig("auto_backup_retention_mode", "Tiered (GFS)");
    await getState()!.setConfig("auto_backup_keep_daily", 1);
    await getState()!.setConfig("auto_backup_keep_weekly", 0);
    await getState()!.setConfig("auto_backup_keep_monthly", 0);
    await getState()!.setConfig("auto_backup_keep_yearly", 0);
    await getState()!.setConfig("auto_backup_keep_min", 1);

    // older backups of the same site, plus files the policy must not touch
    for (const day of ["2020-01-01-00-00", "2020-01-02-00-00"])
      await writeFile(join(dir, `${prefix}RetTest-${day}.zip`), "old");
    await writeFile(join(dir, "not-a-backup.zip"), "keep me");
    await writeFile(join(dir, `${prefix}RetTest-2020-01-03.txt`), "keep me");

    await auto_backup_now();

    const remaining = await readdir(dir);
    // one backup of this site is retained (keep_daily=1, all in one day bucket)
    expect(
      remaining.filter(
        (f) => f.startsWith(`${prefix}RetTest`) && f.endsWith(".zip")
      )
    ).toHaveLength(1);
    // files outside the backup prefix or not zips are never deleted
    expect(remaining).toContain("not-a-backup.zip");
    expect(remaining).toContain(`${prefix}RetTest-2020-01-03.txt`);

    await rm(dir, { recursive: true, force: true });
  });

  it("does not delete anything when retention is not configured", async () => {
    // in cwd rather than tmpdir: auto_backup_now renames the zip into the
    // directory, and rename fails across filesystems
    const dir = await mkdtemp(join(process.cwd(), "sc-backup-retention-"));
    const prefix = getState()!.getConfig("backup_file_prefix");
    await getState()!.setConfig("auto_backup_directory", dir);
    await getState()!.setConfig("auto_backup_retention_mode", "Expiration");
    await getState()!.setConfig("auto_backup_expire_days", null);

    for (const day of ["2020-01-01-00-00", "2020-01-02-00-00"])
      await writeFile(join(dir, `${prefix}RetTest-${day}.zip`), "old");

    await auto_backup_now();

    const remaining = await readdir(dir);
    expect(remaining).toContain(`${prefix}RetTest-2020-01-01-00-00.zip`);
    expect(remaining).toContain(`${prefix}RetTest-2020-01-02-00-00.zip`);

    await rm(dir, { recursive: true, force: true });
  });
});

describe("backup file exclusion", () => {
  it("excludes files matching the configured globs", async () => {
    await File.ensure_file_store();
    const mv = async (fnm: string) => {
      await writeFile(fnm, "cecinestpasunpng");
    };
    await File.from_req_files(
      { mimetype: "video/mp4", name: "bigvideo.mp4", mv, size: 16 },
      1,
      100
    );
    await File.from_req_files(
      { mimetype: "image/png", name: "keepme.png", mv, size: 16 },
      1,
      100
    );
    await File.new_folder("cache");
    await File.from_req_files(
      { mimetype: "image/png", name: "thumb.png", mv, size: 16 },
      1,
      100,
      "cache"
    );
    await getState()!.setConfig("backup_exclude_file_globs", "*.mp4, cache/**");

    const fnm = await create_backup();
    const zip = new Zip(fnm);
    const entries = zip.getEntries().map((e: any) => e.entryName);
    const filesCsv = zip.readAsText("files.csv");
    await unlink(fnm);
    await getState()!.setConfig("backup_exclude_file_globs", "");

    expect(entries).toContain("files/keepme.png");
    expect(entries.filter((e: string) => e.includes("bigvideo"))).toHaveLength(
      0
    );
    expect(entries.filter((e: string) => e.includes("thumb.png"))).toHaveLength(
      0
    );
    // excluded files are also left out of the file metadata
    expect(filesCsv.includes("keepme.png")).toBe(true);
    expect(filesCsv.includes("bigvideo.mp4")).toBe(false);
    expect(filesCsv.includes("thumb.png")).toBe(false);
  });

  it("includes all files when no globs are configured", async () => {
    const fnm = await create_backup();
    const entries = new Zip(fnm)
      .getEntries()
      .map((e: any) => e.entryName)
      .join("\n");
    await unlink(fnm);
    expect(entries.includes("bigvideo.mp4")).toBe(true);
    expect(entries.includes("keepme.png")).toBe(true);
    expect(entries.includes("thumb.png")).toBe(true);
  });
});
