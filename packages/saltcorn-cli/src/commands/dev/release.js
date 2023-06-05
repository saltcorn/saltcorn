/**
 * @category saltcorn-cli
 * @module commands/release
 */
const { Command, flags } = require("@oclif/command");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { sleep } = require("../../common");

/**
 * ReleaseCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class ReleaseCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const {
      args: { version },
    } = this.parse(ReleaseCommand);
    spawnSync("git", ["pull"], {
      stdio: "inherit",
      cwd: ".",
    });
    console.log("\nCurrent branch: \n");
    spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      stdio: "inherit",
      cwd: ".",
    });
    console.log("\n");

    spawnSync("git", ["show", "--summary"], {
      stdio: "inherit",
      cwd: ".",
    });
    console.log("Release begins in five seconds, press Ctrl-C to abort");
    await sleep(5000);
    const pkgs = {
      "@saltcorn/db-common": { dir: "db-common", publish: true },
      "@saltcorn/sqlite": { dir: "sqlite", publish: true },
      "@saltcorn/sqlite-mobile": { dir: "sqlite-mobile", publish: true },
      "@saltcorn/postgres": { dir: "postgres", publish: true },
      "@saltcorn/types": { dir: "saltcorn-types", publish: true },
      "@saltcorn/builder": { dir: "saltcorn-builder", publish: true },
      "@saltcorn/filemanager": { dir: "filemanager", publish: true },
      "@saltcorn/data": { dir: "saltcorn-data", publish: true },
      "@saltcorn/admin-models": {
        dir: "saltcorn-admin-models",
        publish: true,
      },
      "@saltcorn/random-tests": { dir: "saltcorn-random-tests" },
      "@saltcorn/server": { dir: "server", publish: true },
      "@saltcorn/base-plugin": { dir: "saltcorn-base-plugin", publish: true },
      //"saltcorn-cli", publish: true},
      "@saltcorn/markup": { dir: "saltcorn-markup", publish: true },
      "@saltcorn/mobile-app": { dir: "saltcorn-mobile-app", publish: true },
      "@saltcorn/mobile-builder": {
        dir: "saltcorn-mobile-builder",
        publish: true,
      },
      "@saltcorn/sbadmin2": { dir: "saltcorn-sbadmin2", publish: true },
    };

    const updateDependencies = (json, dpkgnm, version) => {
      if (json.dependencies && json.dependencies[dpkgnm])
        json.dependencies[dpkgnm] = version;
      if (json.devDependencies && json.devDependencies[dpkgnm])
        json.devDependencies[dpkgnm] = version;
      if (json.optionalDependencies && json.optionalDependencies[dpkgnm])
        json.optionalDependencies[dpkgnm] = version;
    };

    const updatePkgJson = (dir) => {
      const json = require(`../../../${dir}/package.json`);
      json.version = version;
      if (json.dependencies || json.devDependencies)
        Object.keys(pkgs).forEach((dpkgnm) => {
          updateDependencies(json, dpkgnm, version);
        });
      updateDependencies(json, "@saltcorn/cli", version);
      fs.writeFileSync(
        `packages/${dir}/package.json`,
        JSON.stringify(json, null, 2)
      );
    };
    const compileTsFiles = () => {
      spawnSync("npm", ["install", "--legacy-peer-deps"], {
        stdio: "inherit",
        cwd: ".",
      });
      spawnSync("npm", ["run", "tsc"], {
        stdio: "inherit",
        cwd: ".",
      });
    };
    const publish = (dir) =>
      spawnSync("npm", ["publish", "--access=public"], {
        stdio: "inherit",
        cwd: `packages/${dir}/`,
      });

    const rootPackageJson = require(`../../../../../package.json`);

    compileTsFiles();
    //for each package:
    // 1. update version
    // 2. update dependencies for other packages
    // 3. publish
    spawnSync("npm", ["install", "--legacy-peer-deps"], {
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
    fs.writeFileSync(
      `package.json`,
      JSON.stringify({ ...rootPackageJson, workspaces: undefined }, null, 2)
    );
    spawnSync("npm", ["update", "--legacy-peer-deps"], {
      stdio: "inherit",
      cwd: `packages/saltcorn-cli/`,
    });
    spawnSync("npm", ["audit", "fix"], {
      stdio: "inherit",
      cwd: `packages/saltcorn-cli/`,
    });
    publish("saltcorn-cli");
    fs.writeFileSync(`package.json`, JSON.stringify(rootPackageJson, null, 2));
    // update Dockerfile
    const dockerfile = fs.readFileSync(`Dockerfile.release`, "utf8");
    fs.writeFileSync(
      `Dockerfile.release`,
      dockerfile.replace(/cli@.* --unsafe/, `cli@${version} --unsafe`)
    );
    const dockerfileWithMobile = fs.readFileSync(
      `Dockerfile.mobile.release`,
      "utf8"
    );
    fs.writeFileSync(
      `Dockerfile.mobile.release`,
      dockerfileWithMobile.replace(/cli@.* --unsafe/, `cli@${version} --unsafe`)
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
    console.log("  rm -rf node_modules\n");
    this.exit(0);
  }
}

/**
 * @type {string}
 */
ReleaseCommand.description = `Release a new saltcorn version`;

/**
 * @type {object}
 */
ReleaseCommand.args = [
  { name: "version", required: true, description: "New version number" },
];

module.exports = ReleaseCommand;
