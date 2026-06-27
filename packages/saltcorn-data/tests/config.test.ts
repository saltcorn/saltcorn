import { createRequire } from "module";
const require = createRequire(import.meta.url);
const _sc_db_state = () => (require("../db/state.js") as any).default;
const _sc_base_plugin = () => (require("../base-plugin/index.js") as any).default;
const _sc_models_config = () => (require("../models/config.js") as any).default;
const _sc_db_reset_schema = () => (require("../db/reset_schema.js") as any).default;
const _sc_db_fixtures = () => (require("../db/fixtures.js") as any).default;
import db from "../db/index.js";
const { getState } = _sc_db_state();
getState().registerPlugin("base", _sc_base_plugin());

import { afterAll, describe, it, expect, beforeAll, jest } from "@saltcorn/db-common/test_expect";

const {
  getConfig,
  getAllConfig,
  setConfig,
  get_base_url,
  check_email_mask,
  get_latest_npm_version,
} = _sc_models_config();

afterAll(db.close);

beforeAll(async () => {
  await _sc_db_reset_schema()();
  await _sc_db_fixtures()();
});

describe("Config", () => {
  it("should get default", async () => {
    const d = await getConfig("noval", 5);
    expect(d).toBe(5);
    const sn = await getConfig("site_name");
    expect(sn).toBe("Saltcorn");
  });
  it("should set value", async () => {
    await setConfig("cfg1", 8);
    const d = await getConfig("cfg1", 5);
    expect(d).toBe(8);
    await setConfig("cfg1", 9);
    const x = await getConfig("cfg1", 5);
    expect(x).toBe(9);
    await setConfig("cfgStr", "HelloWorld");
    const s = await getConfig("cfgStr", "");
    expect(s).toBe("HelloWorld");
    await setConfig("log_sql", false);
  });
  it("should set value via state", async () => {
    await getState().setConfig("cfgStr1", "FooBaz");
    const s = getState().getConfig("cfgStr1", "");
    expect(s).toBe("FooBaz");
    const s1 = await getConfig("cfgStr1", "");
    expect(s1).toBe("FooBaz");
  });
  it("should set list int", async () => {
    await setConfig("list_ints", [8]);
    const d = await getConfig("list_ints", 5);
    expect(d).toStrictEqual([8]);
  });
  it("should set list strings", async () => {
    await setConfig("list_strs", ["hello", "World"]);
    const d = await getConfig("list_strs", 5);
    expect(d).toStrictEqual(["hello", "World"]);
  });
  it("should get all value", async () => {
    const d = await getAllConfig();
    expect(d.cfg1).toBe(9);
  });
  it("should get all value", async () => {
    const d = await getState().getAllConfigOrDefaults();
    expect(d.cfg1).toBe(undefined);
    expect(d.log_sql.value).toBe(false);
  });
  it("should get base url", async () => {
    expect(get_base_url()).toBe("/");
    await getState().setConfig("base_url", "foo");
    const s = get_base_url();
    expect(s).toBe("foo/");
    await getState().setConfig("base_url", "bar/");
    const s1 = get_base_url();
    expect(s1).toBe("bar/");
  });
  it("should check email mask", async () => {
    expect(check_email_mask("foo@bar.com")).toBe(true);
    await getState().setConfig("email_mask", "bar.com");
    expect(check_email_mask("foo@bar.com")).toBe(true);
    expect(check_email_mask("foo@baz.com")).toBe(false);
  });
  it("should check email mask", async () => {
    await getState().setConfig("latest_npm_version", {
      foopkg: { version: "1.2.3", time: new Date() },
    });
    const foov = await get_latest_npm_version("foopkg");
    expect(foov).toBe("1.2.3");
    const lpv = await get_latest_npm_version("left-pad");
    expect(lpv).toBe("1.3.0");
  });
});
