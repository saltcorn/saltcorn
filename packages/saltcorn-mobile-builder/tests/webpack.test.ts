import db from "@saltcorn/data/db/index";
import { spawnSync } from "child_process";
import Plugin from "@saltcorn/data/models/plugin";
import { assertIsSet } from "@saltcorn/data/tests/assertions";
import { rmSync, existsSync } from "fs";
import { join } from "path";
const load_plugins = require("@saltcorn/server/load_plugins");

afterAll(db.close);

jest.setTimeout(30000);

describe("webpack build", () => {
  const bundleDir = join(__dirname, "bundle");
  it("without plugins", async () => {
    if (existsSync(bundleDir))
      rmSync(bundleDir, { recursive: true, force: true });
    const result = spawnSync(
      "npm",
      ["run", "build", "--", "--env", `output=${__dirname}`],
      {
        cwd: __dirname,
      }
    );
    const output = result.output.toString();
    expect(result.status).toBe(0);
    expect(output.indexOf(" compiled with ")).toBeGreaterThan(-1);
    for (const expected of [
      bundleDir,
      join(bundleDir, "base_plugin.bundle.js"),
      join(bundleDir, "common_chunks.bundle.js"),
      join(bundleDir, "data.bundle.js"),
      join(bundleDir, "markup.bundle.js"),
      join(bundleDir, "sbadmin2.bundle.js"),
    ]) {
      expect(existsSync(expected)).toBe(true);
    }
  });

  it("with plugins", async () => {
    const anyBootstrapTheme = await Plugin.store_by_name("any-bootstrap-theme");
    assertIsSet(anyBootstrapTheme);
    delete anyBootstrapTheme.id;
    await load_plugins.loadAndSaveNewPlugin(anyBootstrapTheme);

    const tabulator = await Plugin.store_by_name("tabulator");
    assertIsSet(tabulator);
    delete tabulator.id;
    await load_plugins.loadAndSaveNewPlugin(tabulator);

    if (existsSync(bundleDir))
      rmSync(bundleDir, { recursive: true, force: true });
    const result = spawnSync(
      "npm",
      [
        "run",
        "build",
        "--",
        "--env",
        `plugins=${JSON.stringify([anyBootstrapTheme, tabulator])}`,
        "--env",
        `output=${__dirname}`,
      ],
      {
        cwd: __dirname,
      }
    );
    const output = result.output.toString();
    expect(result.status).toBe(0);
    expect(output.indexOf(" compiled with ")).toBeGreaterThan(-1);
    for (const expected of [
      bundleDir,
      join(bundleDir, "any-bootstrap-theme.bundle.js"),
      join(bundleDir, "tabulator.bundle.js"),
    ]) {
      expect(existsSync(expected)).toBe(true);
    }
  });
});
