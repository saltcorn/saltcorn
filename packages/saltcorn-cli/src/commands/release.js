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
      "@saltcorn/sbadmin2": { dir: "saltcorn-sbadmin2", publish: true },
    };

    const updatePkgJson = (dir) => {
      const json = require(`../../../${dir}/package.json`);
      json.version = version;
      if (json.dependencies || json.devDependencies)
        Object.keys(pkgs).forEach((dpkgnm) => {
          if (json.dependencies && json.dependencies[dpkgnm])
            json.dependencies[dpkgnm] = version;
          if (json.devDependencies && json.devDependencies[dpkgnm])
            json.devDependencies[dpkgnm] = version;
        });
      fs.writeFileSync(
        `packages/${dir}/package.json`,
        JSON.stringify(json, null, 2)
      );
    };
    const publish = (dir) =>
      spawnSync("npm", ["publish"], {
        stdio: "inherit",
        cwd: `packages/${dir}/`,
      });

    //for each package:
    // 1. update version
    // 2. update dependencies for other packages
    // 3. publish
    spawnSync("npm", ["install"], {
      stdio: "inherit",
      cwd: `packages/saltcorn-cli/`,
    });
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
    spawnSync("npm", ["update"], {
      stdio: "inherit",
      cwd: `packages/saltcorn-cli/`,
    });
    spawnSync("npm", ["audit", "fix"], {
      stdio: "inherit",
      cwd: `packages/saltcorn-cli/`,
    });
    publish("saltcorn-cli");

    // update Dockerfile
    fs.writeFileSync(
      `Dockerfile`,
      fs
        .readFileSync(`Dockerfile`)
        .replace(/cli\@.* --unsafe/, `cli@${version} --unsafe`)
    );
    //git commit tag and push
    spawnSync("git", ["commit", "-am", "v" + version], {
      stdio: "inherit",
    });
    spawnSync("git", ["tag", "-a", "v" + version, "-m", "v" + version], {
      stdio: "inherit",
    });
    spawnSync("git", ["push", "origin", "v" + version], {
      stdio: "inherit",
    });
    spawnSync("git", ["push"], {
      stdio: "inherit",
    });
    console.log("Now run:\n");
    console.log("  rm -rf packages/saltcorn-cli/node_modules\n");
    this.exit(0);
  }
}

ReleaseCommand.description = `Release a new saltcorn version`;

ReleaseCommand.args = [
  { name: "version", required: true, description: "New version number" },
];

module.exports = ReleaseCommand;
