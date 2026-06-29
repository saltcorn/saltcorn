import Table from "@saltcorn/data/models/table";
import Plugin from "@saltcorn/data/models/plugin";
import { getState, add_tenant } from "@saltcorn/data/db/state";
import _am_pack from "@saltcorn/admin-models/models/pack";
const { install_pack } = _am_pack;
import _am_tenant from "@saltcorn/admin-models/models/tenant";
const { switchToTenant, insertTenant, create_tenant } = _am_tenant;
import { resetToFixtures } from "../auth/testhelp.js";
import db from "@saltcorn/data/db";
import { get_store_items } from "../routes/plugins.js";

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
      const loadAndSaveNewPlugin = Plugin.loadAndSaveNewPlugin;

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
        const loadAndSaveNewPlugin = Plugin.loadAndSaveNewPlugin;

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
        const loadAndSaveNewPlugin = Plugin.loadAndSaveNewPlugin;

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
    it("cannot install git plugins on tenant when tenants_install_git is false", async () => {
      await db.runWithTenant("test101", async () => {
        const loadAndSaveNewPlugin = Plugin.loadAndSaveNewPlugin;

        await install_pack(
          plugin_pack({
            name: "some-git-plugin",
            source: "git",
            location: "https://github.com/example/some-git-plugin",
          }),
          "Some git plugin",
          loadAndSaveNewPlugin
        );
        const dbPlugin = await Plugin.findOne({ name: "some-git-plugin" });
        expect(dbPlugin).toBe(null);
      });
    });
    it("cannot install github plugins on tenant when tenants_install_git is false", async () => {
      await db.runWithTenant("test101", async () => {
        const loadAndSaveNewPlugin = Plugin.loadAndSaveNewPlugin;

        await install_pack(
          plugin_pack({
            name: "some-github-plugin",
            source: "github",
            location: "example/some-github-plugin",
          }),
          "Some github plugin",
          loadAndSaveNewPlugin
        );
        const dbPlugin = await Plugin.findOne({ name: "some-github-plugin" });
        expect(dbPlugin).toBe(null);
      });
    });
    it("loadPlugin skips git plugin on tenant when tenants_install_git is false", async () => {
      await db.runWithTenant("test101", async () => {
        const result = await Plugin.loadPlugin(
          new Plugin({
            name: "some-git-plugin",
            source: "git",
            location: "https://github.com/example/some-git-plugin",
          })
        );
        expect(result).toBeUndefined();
      });
    });
    it("loadPlugin skips github plugin on tenant when tenants_install_git is false", async () => {
      await db.runWithTenant("test101", async () => {
        const result = await Plugin.loadPlugin(
          new Plugin({
            name: "some-github-plugin",
            source: "github",
            location: "example/some-github-plugin",
          })
        );
        expect(result).toBeUndefined();
      });
    });
    it("can install unsafe plugins on tenant when permitted", async () => {
      await getState().setConfig("tenants_unsafe_plugins", true);
      await db.runWithTenant("test101", async () => {
        const loadAndSaveNewPlugin = Plugin.loadAndSaveNewPlugin;

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
    const loadAndSaveNewPlugin = Plugin.loadAndSaveNewPlugin;
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
    const loadAndSaveNewPlugin = Plugin.loadAndSaveNewPlugin;
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

  it("installs and upgrades a fixed version", async () => {
    const loadAndSaveNewPlugin = Plugin.loadAndSaveNewPlugin;
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
    expect(dbPlugin.version).toBe("0.0.5");
  });

  it("installs and downgrades a fixed version", async () => {
    const loadAndSaveNewPlugin = Plugin.loadAndSaveNewPlugin;
    await loadAndSaveNewPlugin(
      new Plugin({
        name: "@christianhugoch/empty_sc_test_plugin",
        location: "@christianhugoch/empty_sc_test_plugin",
        source: "npm",
        version: "0.2.0",
      }),
      true
    );
    const dbPlugin = await Plugin.findOne({
      name: "@christianhugoch/empty_sc_test_plugin",
    });
    expect(dbPlugin).not.toBe(null);
    expect(dbPlugin.version).toBe("0.1.0");
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
    const loadAndSaveNewPlugin = Plugin.loadAndSaveNewPlugin;
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

  it("upgrades to latest with downgrade to supported", async () => {
    const loadAndSaveNewPlugin = Plugin.loadAndSaveNewPlugin;
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
    const loadAndSaveNewPlugin = Plugin.loadAndSaveNewPlugin;
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

  it("upgrades to fixed version with downgrade to supported", async () => {
    const loadAndSaveNewPlugin = Plugin.loadAndSaveNewPlugin;
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
        version: "0.2.0",
      }),
      true
    );
    const newPlugin = await Plugin.findOne({
      name: "@christianhugoch/empty_sc_test_plugin",
    });
    expect(newPlugin).not.toBe(null);
    expect(newPlugin.version).toBe("0.1.0");
  });
});

describe("Tenant git plugin store filtering", () => {
  const mockReq = { flash: () => {}, __: (s) => s };

  if (!db.isSQLite) {
    it("git plugin is excluded from installed list when tenants_install_git is false", async () => {
      await db.runWithTenant("test101", async () => {
        const gitPlugin = new Plugin({
          name: "test-git-plugin",
          source: "git",
          location: "https://github.com/example/test-git-plugin",
        });
        await gitPlugin.upsert();

        const items = await get_store_items(mockReq);
        const names = items.map((i) => i.name);
        expect(names).not.toContain("test-git-plugin");

        await db.deleteWhere("_sc_plugins", { name: "test-git-plugin" });
      });
    });

    it("github plugin is excluded from installed list when tenants_install_git is false", async () => {
      await db.runWithTenant("test101", async () => {
        const githubPlugin = new Plugin({
          name: "test-github-plugin",
          source: "github",
          location: "example/test-github-plugin",
        });
        await githubPlugin.upsert();

        const items = await get_store_items(mockReq);
        const names = items.map((i) => i.name);
        expect(names).not.toContain("test-github-plugin");

        await db.deleteWhere("_sc_plugins", { name: "test-github-plugin" });
      });
    });

    it("git plugin does not appear as installed in set=all when tenants_install_git is false", async () => {
      await db.runWithTenant("test101", async () => {
        const gitPlugin = new Plugin({
          name: "test-git-plugin",
          source: "git",
          location: "https://github.com/example/test-git-plugin",
        });
        await gitPlugin.upsert();

        const items = await get_store_items(mockReq);
        const match = items.find((i) => i.name === "test-git-plugin");
        expect(match).toBeUndefined();

        await db.deleteWhere("_sc_plugins", { name: "test-git-plugin" });
      });
    });
  } else {
    it("does not support tenants on SQLite", async () => {
      expect(db.isSQLite).toBe(true);
    });
  }
});
