const { Command, flags } = require("@oclif/command");
const fs = require("fs");
const { spawnSync } = require("child_process");

class ReleaseCommand extends Command {
  async run() {
    const {
      args: { version },
    } = this.parse(ReleaseCommand);

    const pkgs = {
      "@saltcorn/e2e": { dir: "e2e" },
      "@saltcorn/builder": { dir: "saltcorn-builder", publish: true },
      "@saltcorn/data": { dir: "saltcorn-data", publish: true },
      "@saltcorn/random-tests": { dir: "saltcorn-random-tests" },
      "@saltcorn/server": { dir: "server", publish: true },
      "@saltcorn/base-plugin": { dir: "saltcorn-base-plugin", publish: true },
      //"saltcorn-cli", publish: true},
      "@saltcorn/markup": { dir: "saltcorn-markup", publish: true },
      "@saltcorn/sbadmin": { dir: "saltcorn-sbadmin2", publish: true },
    };

    const updatePkgJson = (dir) => {
      const json = require(`../../../${dir}/package.json`);
      json.version = version;
      if (json.dependencies)
        Object.keys(pkgs).forEach((dpkgnm) => {
          if (json.dependencies[dpkgnm]) json.dependencies[dpkgnm] = version;
        });
      fs.writeFileSync(
        `packages/${dir}/package.json`,
        JSON.stringify(json, null, 2)
      );
    };
    const publish = (dir) =>
      spawnSync("npm", ["publish", "--dry-run"], {
        stdio: "inherit",
        cwd: `packages/${dir}/`,
      });

    //for each package:
    // 1. update version
    // 2. update dependencies for other packages
    // 3. publish

    for (const p of Object.values(pkgs)) {
      updatePkgJson(p.dir);
      if (p.publish) publish(p.dir);
    }

    // for cli:
    // 1. update version
    // 2. update dependencies for other pkgs
    // 3. run npm update
    // 3. publish
    updatePkgJson("saltcorn-cli");

    publish("saltcorn-cli");
    // commit
    // tag
    this.exit(0);
  }
}

ReleaseCommand.description = `Release a new saltcorn version`;

ReleaseCommand.args = [
  { name: "version", required: true, description: "New version number" },
];

module.exports = ReleaseCommand;
