const Plugin = require("../models/plugin");
const db = require("../db/index.js");

const { getState } = require("../db/state");

getState().registerPlugin("base", require("../base-plugin"));
jest.setTimeout(30000);

afterAll(db.close);

describe("plugin", () => {
  it("cruds", async () => {
    const ps = await Plugin.find();
    expect(ps.length).toBe(2);
    const p = await Plugin.findOne({ name: "base" });
    expect(p.name).toBe("base");
    const depviews = await p.dependant_views();
    expect(ps.length > 0).toBe(true);

    const oldv = p.version;
    p.version = 9.9;
    await p.upsert();
    p.version = oldv;
    await p.upsert();
    const newp = new Plugin({
      name: "foo",
      location: "bar/rol",
      source: "github",
    });
    await newp.upsert();
    await newp.delete();
  });
});

describe("plugin store", () => {
  it("reset the plugin store cache", async () => {
    getState().deleteConfig("available_plugins");
    getState().deleteConfig("available_plugins_fetched_at");
  });
  it("fetches the plugin store", async () => {
    const plugins = await Plugin.store_plugins_available();
    expect(plugins.length > 0).toBe(true);
    const cache = getState().getConfig("available_plugins", false);
    expect(plugins).toStrictEqual(cache);

    const plugin = await Plugin.store_by_name(plugins[0].name);
    const noplugin = await Plugin.store_by_name("nosuchplugin");
    expect(noplugin).toBe(null);

    await getState().setConfig("available_plugins", []);
    const plugins1 = await Plugin.store_plugins_available();
    expect(plugins1).toStrictEqual([]);
  });
  it("reset the plugin store cache", async () => {});
  it("reset the plugin store cache", async () => {
    await getState().deleteConfig("available_plugins");
    await getState().deleteConfig("available_plugins_fetched_at");
  });
});
