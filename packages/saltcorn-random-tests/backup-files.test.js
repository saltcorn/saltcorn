const db = require("@saltcorn/data/db");
const reset = require("@saltcorn/data/db/reset_schema");
const path = require("path");
const fs = require("fs");
const {
  runConfigurationCheck,
} = require("@saltcorn/admin-models/models/config-check");
const load_plugins = require("@saltcorn/server/load_plugins");
const { restore } = require("@saltcorn/admin-models/models/backup");
const { getState } = require("@saltcorn/data/db/state");
const { mockReqRes } = require("@saltcorn/data/tests/mocks");
const getApp = require("@saltcorn/server/app");

afterAll(db.close);

jest.setTimeout(100000);
getState().registerPlugin("base", require("@saltcorn/base-plugin"));

describe("backup files", () => {
  it("restores and passes configuration checks", async () => {
    const dir = path.join(__dirname, "backup-files");
    const fileNms = await fs.promises.readdir(dir);
    const backupFiles = fileNms.filter(
      (fnm) => fnm.startsWith("sc-backup") && fnm.endsWith(".zip")
    );
    expect(backupFiles.length).toBeGreaterThanOrEqual(1);
    const savePlugin = (p) => {
      if (p.source === "local") {
        p.source = "npm";
        p.location = p.name;
        p.name = p.name.split("/")[1];
      }
      return load_plugins.loadAndSaveNewPlugin(p);
    };

    for (const file of backupFiles) {
      await reset();
      const restore_res = await restore(path.join(dir, file), savePlugin, true);
      expect(restore_res).toBe(undefined);
      const app = await getApp({ disableCsrf: true });
      const { errors, pass, passes } = await runConfigurationCheck(
        mockReqRes.req,
        true,
        app
      );
      expect(errors).toStrictEqual([]);
      expect(pass).toBe(true);
      //console.log("cfg check for", file, "passes", passes);
    }
  });
});
