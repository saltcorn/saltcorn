/**
 * @category saltcorn-cli
 * @module commands/release
 */
const { Command, Flags, Args } = require("@oclif/core");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { sleep } = require("../../common");

const runCmd = (cmd, args, options) => {
  const dirStr =
    options?.cwd && options.cwd !== "." ? ` [cwd=${options.cwd}]` : "";
  console.log(`>${dirStr} ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, options);
  if (res.status !== 0)
    throw new Error(
      `Non-zero exit status for command: "${cmd} ${args.join(" ")}" in ${
        options?.cwd || "."
      }`
    );
};

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
      flags,
    } = await this.parse(ReleaseCommand);
    runCmd("git", ["pull"], {
      stdio: "inherit",
      cwd: ".",
    });
    console.log("\nCurrent branch: \n");
    spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      stdio: "inherit",
      cwd: ".",
    });
    console.log("\n");

    runCmd("git", ["show", "--summary"], {
      stdio: "inherit",
      cwd: ".",
    });
    console.log("Release begins in five seconds, press Ctrl-C to abort");
    await sleep(5000);
    const pkgs = {
      "@saltcorn/db-common": { dir: "db-common", publish: true },
      "@saltcorn/common-code": { dir: "common-code", publish: true },
      "@saltcorn/plugins-loader": { dir: "plugins-loader", publish: true },
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
      const json = require(`../../../../${dir}/package.json`);
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
      runCmd("npm", ["install", "--legacy-peer-deps"], {
        stdio: "inherit",
        cwd: ".",
      });
      runCmd("npm", ["run", "tsc"], {
        stdio: "inherit",
        cwd: ".",
      });
    };
    const publish = async (dir, tags0) => {
      const tags = !tags0 ? [] : Array.isArray(tags0) ? tags0 : [tags0];
      if (flags.tag) tags.push(flags.tag);
      const firstTag = tags[0];
      runCmd(
        "npm",
        [
          "publish",
          "--access=public",
          ...(firstTag ? ["--tag", firstTag] : []),
        ],
        {
          stdio: "inherit",
          cwd: `packages/${dir}/`,
        }
      );
      tags.shift();
      for (const tag of tags) {
        await sleep(7000);
        runCmd("npm", ["dist-tag", "add", `@saltcorn/cli@${version}`, tag], {
          stdio: "inherit",
          cwd: `packages/${dir}/`,
        });
      }
    };

    const rootPackageJson = require(`../../../../../package.json`);

    compileTsFiles();
    //for each package:1
    // 1. update version
    // 2. update dependencies for other packages
    // 3. publish

    for (const p of Object.values(pkgs)) {
      updatePkgJson(p.dir);
      if (p.publish) {
        await publish(p.dir);
        await sleep(3000);
      }
    }
    await sleep(5000);

    runCmd("npm", ["cache", "clear", "--force"], {
      stdio: "inherit",
      cwd: `.`,
    });

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

    runCmd("npm", ["install", "--legacy-peer-deps"], {
      stdio: "inherit",
      cwd: `packages/saltcorn-cli/`,
    });

    runCmd("npm", ["update", "--legacy-peer-deps"], {
      stdio: "inherit",
      cwd: `packages/saltcorn-cli/`,
    });
    runCmd("npm", ["install", "--legacy-peer-deps"], {
      stdio: "inherit",
      cwd: `packages/saltcorn-cli/`,
    });
    runCmd("npm", ["run", "manifest"], {
      stdio: "inherit",
      cwd: `packages/saltcorn-cli/`,
    });
    runCmd("npm", ["install", "--legacy-peer-deps"], {
      stdio: "inherit",
      cwd: ".",
    });
    spawnSync("npm", ["run", "tsc"], {
      stdio: "inherit",
      cwd: ".",
    });
    // do not run 'audit fix' on full point releases, only on -beta.x, -rc.x etc
    /*if (version.includes("-"))
      runCmd("npm", ["audit", "fix"], {
        stdio: "inherit",
        cwd: `packages/saltcorn-cli/`,
      });*/
    await publish("saltcorn-cli", "next");
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
    runCmd("git", ["commit", "-am", "v" + version], {
      stdio: "inherit",
    });
    runCmd("git", ["tag", "-a", "v" + version, "-m", "v" + version], {
      stdio: "inherit",
    });
    runCmd("git", ["push", "origin", "v" + version], {
      stdio: "inherit",
    });
    runCmd("git", ["push"], {
      stdio: "inherit",
    });
    console.log("Now run:\n");
    console.log("npm install --legacy-peer-deps && npm run tsc\n");
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
ReleaseCommand.args = {
  version: Args.string({
    required: true,
    description: "New version number",
  }),
};

ReleaseCommand.flags = {
  tag: Flags.string({
    char: "t",
    description: "NPM tag",
  }),
};
module.exports = ReleaseCommand;
