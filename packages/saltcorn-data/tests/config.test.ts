import db from "../db/index.js";
import { getState } from "../db/state.js";
import {
  getConfig,
  getAllConfig,
  setConfig,
  get_base_url,
  check_email_mask,
  get_latest_npm_version,
} from "../models/config.js";
import basePluginMod from "../base-plugin/index.js";
import resetSchemaMod from "../db/reset_schema.js";
import fixturesMod from "../db/fixtures.js";
getState()!.registerPlugin("base", basePluginMod);

import {
  afterAll,
  describe,
  it,
  expect,
  beforeAll,
  jest,
} from "@saltcorn/db-common/test_expect";
import { createServer, Server } from "http";
import type { AddressInfo } from "net";

afterAll(db.close);

// Stand-in for the npm registry. get_latest_npm_version used to be tested
// against the real registry, so any network hiccup in CI failed the assertion.
let registryServer: Server | undefined;
const registryRequests: string[] = [];

beforeAll(async () => {
  await resetSchemaMod();
  await fixturesMod();
  const server = createServer((req, res) => {
    registryRequests.push(req.url!);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ versions: { "1.0.0": {}, "1.1.0": {}, "1.3.0": {} } })
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  registryServer = server;
  process.env.SALTCORN_NPM_REGISTRY = `http://127.0.0.1:${
    (server.address() as AddressInfo).port
  }`;
});

afterAll(async () => {
  delete process.env.SALTCORN_NPM_REGISTRY;
  const server = registryServer;
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve()))
  );
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
    await getState()!.setConfig("cfgStr1", "FooBaz");
    const s = getState()!.getConfig("cfgStr1", "");
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
    const d = await getState()!.getAllConfigOrDefaults();
    expect(d.cfg1).toBe(undefined);
    expect(d.log_sql.value).toBe(false);
  });
  it("should get base url", async () => {
    expect(get_base_url()).toBe("/");
    await getState()!.setConfig("base_url", "foo");
    const s = get_base_url();
    expect(s).toBe("foo/");
    await getState()!.setConfig("base_url", "bar/");
    const s1 = get_base_url();
    expect(s1).toBe("bar/");
  });
  it("should check email mask", async () => {
    expect(check_email_mask("foo@bar.com")).toBe(true);
    await getState()!.setConfig("email_mask", "bar.com");
    expect(check_email_mask("foo@bar.com")).toBe(true);
    expect(check_email_mask("foo@baz.com")).toBe(false);
  });
  it("should get latest npm version", async () => {
    await getState()!.setConfig("latest_npm_version", {
      foopkg: { version: "1.2.3", time: new Date() },
    });
    const foov = await get_latest_npm_version("foopkg");
    expect(foov).toBe("1.2.3");
    expect(registryRequests).toStrictEqual([]); // fresh in cache, not fetched

    const lpv = await get_latest_npm_version("left-pad");
    expect(lpv).toBe("1.3.0");
    expect(registryRequests).toStrictEqual(["/left-pad"]);
    const stored = getState()!.getConfig("latest_npm_version", {});
    expect(stored["left-pad"].version).toBe("1.3.0");
  });
});
