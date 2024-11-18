const Table = require("@saltcorn/data/models/table");
const Plugin = require("@saltcorn/data/models/plugin");
const { getState, add_tenant } = require("@saltcorn/data/db/state");
const { install_pack } = require("@saltcorn/admin-models/models/pack");
const {
  switchToTenant,
  insertTenant,
  create_tenant,
} = require("@saltcorn/admin-models/models/tenant");
const { resetToFixtures } = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const load_plugins = require("../load_plugins");

beforeAll(async () => {
  if (!db.isSQLite) await db.query(`drop schema if exists test101 CASCADE `);
  await resetToFixtures();
});
afterAll(db.close);

jest.setTimeout(30000);
const plugin_pack = (plugin) => ({
  tables: [],
  views: [],
  plugins: [
    {
      ...plugin,
      configuration: null,
    },
  ],
  pages: [],
  roles: [],
  library: [],
  triggers: [],
});

describe("Tenant cannot install unsafe plugins", () => {
  if (!db.isSQLite) {
    it("creates a new tenant", async () => {
      db.enable_multi_tenant();
      const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;

      await getState().setConfig("base_url", "http://example.com/");

      add_tenant("test101");

      await switchToTenant(
        await insertTenant("test101", "foo@foo.com", ""),
        "http://test101.example.com/"
      );

      await create_tenant({
        t: "test101",
        loadAndSaveNewPlugin,
        plugin_loader() {},
      });
    });
    it("can install safe plugins on tenant", async () => {
      await db.runWithTenant("test101", async () => {
        const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;

        await install_pack(
          plugin_pack({
            name: "html",
            source: "npm",
            location: "@saltcorn/html",
          }),
          "Todo list",
          loadAndSaveNewPlugin
        );
        const dbPlugin = await Plugin.findOne({ name: "html" });
        expect(dbPlugin).not.toBe(null);
      });
    });
    it("cannot install unsafe plugins on tenant", async () => {
      await db.runWithTenant("test101", async () => {
        const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;

        await install_pack(
          plugin_pack({
            name: "sql-list",
            source: "npm",
            location: "@saltcorn/sql-list",
          }),
          "Todo list",
          loadAndSaveNewPlugin
        );
        const dbPlugin = await Plugin.findOne({ name: "sql-list" });
        expect(dbPlugin).toBe(null);
      });
    });
    it("can install unsafe plugins on tenant when permitted", async () => {
      await getState().setConfig("tenants_unsafe_plugins", true);
      await db.runWithTenant("test101", async () => {
        const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;

        await install_pack(
          plugin_pack({
            name: "sql-list",
            source: "npm",
            location: "@saltcorn/sql-list",
          }),
          "Todo list",
          loadAndSaveNewPlugin
        );
        const dbPlugin = await Plugin.findOne({ name: "sql-list" });
        expect(dbPlugin).not.toBe(null);
      });
    });
  } else {
    it("does not support tenants on SQLite", async () => {
      expect(db.isSQLite).toBe(true);
    });
  }
});

describe("Stable versioning install", () => {
  /*
    empty_sc_test_plugin:
      - starts without engine property but from the second version on it has
    empty_sc_test_plugin_two:
      - has no engine property in any version
  */
  beforeEach(async () => {
    for (const plugin of [
      "@christianhugoch/empty_sc_test_plugin",
      "@christianhugoch/empty_sc_test_plugin_two",
    ]) {
      const dbPlugin = await Plugin.findOne({ name: plugin });
      if (dbPlugin) await dbPlugin.delete();
    }
  });
  it("installs latest", async () => {
    const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;
    await loadAndSaveNewPlugin(
      new Plugin({
        name: "@christianhugoch/empty_sc_test_plugin_two",
        location: "@christianhugoch/empty_sc_test_plugin_two",
        source: "npm",
        version: "latest",
      })
    );
    const dbPlugin = await Plugin.findOne({
      name: "@christianhugoch/empty_sc_test_plugin_two",
    });
    expect(dbPlugin).not.toBe(null);
    expect(dbPlugin.version).toBe("0.0.3");
  });

  it("installs and downgrades latest", async () => {
    const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;
    await loadAndSaveNewPlugin(
      new Plugin({
        name: "@christianhugoch/empty_sc_test_plugin",
        location: "@christianhugoch/empty_sc_test_plugin",
        source: "npm",
        version: "latest",
      }),
      true
    );
    const dbPlugin = await Plugin.findOne({
      name: "@christianhugoch/empty_sc_test_plugin",
    });
    expect(dbPlugin).not.toBe(null);
    expect(dbPlugin.version).toBe("0.1.0");
  });

  it("installs a fixed version", async () => {
    const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;
    await loadAndSaveNewPlugin(
      new Plugin({
        name: "@christianhugoch/empty_sc_test_plugin",
        location: "@christianhugoch/empty_sc_test_plugin",
        source: "npm",
        version: "0.0.5",
      })
    );
    const dbPlugin = await Plugin.findOne({
      name: "@christianhugoch/empty_sc_test_plugin",
    });
    expect(dbPlugin).not.toBe(null);
    expect(dbPlugin.version).toBe("0.1.0");
  });

  it("installs and downgrades a fixed version", async () => {
    const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;
    await loadAndSaveNewPlugin(
      new Plugin({
        name: "@christianhugoch/empty_sc_test_plugin",
        location: "@christianhugoch/empty_sc_test_plugin",
        source: "npm",
        version: "0.0.6",
      }),
      true
    );
    const dbPlugin = await Plugin.findOne({
      name: "@christianhugoch/empty_sc_test_plugin",
    });
    expect(dbPlugin).not.toBe(null);
    expect(dbPlugin.version).toBe("0.0.6");
  });
});

describe("Stable versioning upgrade", () => {
  beforeEach(async () => {
    for (const plugin of [
      "@christianhugoch/empty_sc_test_plugin",
      "@christianhugoch/empty_sc_test_plugin_two",
    ]) {
      const dbPlugin = await Plugin.findOne({ name: plugin });
      if (dbPlugin) await dbPlugin.delete();
    }
  });

  it("upgrades to latest", async () => {
    const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;
    await loadAndSaveNewPlugin(
      new Plugin({
        name: "@christianhugoch/empty_sc_test_plugin_two",
        location: "@christianhugoch/empty_sc_test_plugin_two",
        source: "npm",
        version: "0.0.1",
      }),
      true
    );
    const oldPlugin = await Plugin.findOne({
      name: "@christianhugoch/empty_sc_test_plugin_two",
    });
    expect(oldPlugin).not.toBe(null);
    expect(oldPlugin.version).toBe("0.0.1");

    await loadAndSaveNewPlugin(
      new Plugin({
        id: oldPlugin.id,
        name: "@christianhugoch/empty_sc_test_plugin_two",
        location: "@christianhugoch/empty_sc_test_plugin_two",
        source: "npm",
        version: "latest",
      }),
      true
    );
    const newPlugin = await Plugin.findOne({
      name: "@christianhugoch/empty_sc_test_plugin_two",
    });
    expect(newPlugin).not.toBe(null);
    expect(newPlugin.version).toBe("0.0.3");
  });

  it("upgrades to latest with downgrade", async () => {
    const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;
    await loadAndSaveNewPlugin(
      new Plugin({
        name: "@christianhugoch/empty_sc_test_plugin",
        location: "@christianhugoch/empty_sc_test_plugin",
        source: "npm",
        version: "0.0.1",
      }),
      true
    );
    const oldPlugin = await Plugin.findOne({
      name: "@christianhugoch/empty_sc_test_plugin",
    });
    expect(oldPlugin).not.toBe(null);
    expect(oldPlugin.version).toBe("0.0.1");

    await loadAndSaveNewPlugin(
      new Plugin({
        id: oldPlugin.id,
        name: "@christianhugoch/empty_sc_test_plugin",
        location: "@christianhugoch/empty_sc_test_plugin",
        source: "npm",
        version: "latest",
      }),
      true
    );
    const newPlugin = await Plugin.findOne({
      name: "@christianhugoch/empty_sc_test_plugin",
    });
    expect(newPlugin).not.toBe(null);
    expect(newPlugin.version).toBe("0.1.0");
  });

  it("upgrades to fixed version", async () => {
    const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;
    await loadAndSaveNewPlugin(
      new Plugin({
        name: "@christianhugoch/empty_sc_test_plugin_two",
        location: "@christianhugoch/empty_sc_test_plugin_two",
        source: "npm",
        version: "0.0.1",
      }),
      true
    );
    const oldPlugin = await Plugin.findOne({
      name: "@christianhugoch/empty_sc_test_plugin_two",
    });
    expect(oldPlugin).not.toBe(null);
    expect(oldPlugin.version).toBe("0.0.1");

    await loadAndSaveNewPlugin(
      new Plugin({
        id: oldPlugin.id,
        name: "@christianhugoch/empty_sc_test_plugin_two",
        location: "@christianhugoch/empty_sc_test_plugin_two",
        source: "npm",
        version: "0.0.3",
      }),
      true
    );
    const newPlugin = await Plugin.findOne({
      name: "@christianhugoch/empty_sc_test_plugin_two",
    });
    expect(newPlugin).not.toBe(null);
    expect(newPlugin.version).toBe("0.0.3");
  });

  it("upgrades to fixed version with downgrade", async () => {
    const loadAndSaveNewPlugin = load_plugins.loadAndSaveNewPlugin;
    await loadAndSaveNewPlugin(
      new Plugin({
        name: "@christianhugoch/empty_sc_test_plugin",
        location: "@christianhugoch/empty_sc_test_plugin",
        source: "npm",
        version: "0.0.1",
      }),
      true
    );
    const oldPlugin = await Plugin.findOne({
      name: "@christianhugoch/empty_sc_test_plugin",
    });
    expect(oldPlugin).not.toBe(null);
    expect(oldPlugin.version).toBe("0.0.1");

    await loadAndSaveNewPlugin(
      new Plugin({
        id: oldPlugin.id,
        name: "@christianhugoch/empty_sc_test_plugin",
        location: "@christianhugoch/empty_sc_test_plugin",
        source: "npm",
        version: "0.0.6",
      }),
      true
    );
    const newPlugin = await Plugin.findOne({
      name: "@christianhugoch/empty_sc_test_plugin",
    });
    expect(newPlugin).not.toBe(null);
    expect(newPlugin.version).toBe("0.0.6");
  });
});
