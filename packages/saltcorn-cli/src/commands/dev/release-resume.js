/**
 * @category saltcorn-cli
 * @module commands/release-resume
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
 * ReleaseResumeCommand Class
 *
 * Resumes a `dev:release` that failed after all dependency packages were
 * published, i.e. at the cli install/publish step. Safe to run repeatedly
 * from that point: it re-applies the temporary root package.json change,
 * waits for the registry, then publishes the cli and restores workspaces.
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class ReleaseResumeCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const {
      args: { version, tag: tagArg },
      flags,
    } = await this.parse(ReleaseResumeCommand);
    const tag = tagArg || flags.tag || "next";
    const pkgs = {
      "@saltcorn/db-common": { dir: "db-common", publish: true },
      "@saltcorn/common-code": { dir: "common-code", publish: true },
      "@saltcorn/plugins-loader": { dir: "plugins-loader", publish: true },
      "@saltcorn/sqlite": { dir: "sqlite", publish: true },
      "@saltcorn/sqlite-mobile": { dir: "sqlite-mobile", publish: true },
      "@saltcorn/postgres": { dir: "postgres", publish: true },
      "@saltcorn/types": { dir: "saltcorn-types", publish: true },
      "@saltcorn/builder": { dir: "saltcorn-builder", publish: true },
      "@saltcorn/workflow-editor": { dir: "workflow-editor", publish: true },
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
    const publish = async (dir, tag) => {
      runCmd(
        "npm",
        ["publish", "--access=public", ...(tag ? ["--tag", tag] : [])],
        {
          stdio: "inherit",
          cwd: `packages/${dir}/`,
        }
      );
    };
    // the registry can take a while before newly published versions resolve
    const waitForRegistry = async () => {
      const toCheck = Object.entries(pkgs)
        .filter(([, p]) => p.publish)
        .map(([name]) => name);
      for (let attempt = 1; attempt <= 60; attempt++) {
        const missing = toCheck.filter((name) => {
          const res = spawnSync(
            "npm",
            ["view", `${name}@${version}`, "version"],
            {
              encoding: "utf8",
            }
          );
          return res.status !== 0 || res.stdout.trim() !== version;
        });
        if (missing.length === 0) return;
        console.log(
          `Waiting for registry (attempt ${attempt}), not yet available: ${missing.join(
            ", "
          )}`
        );
        await sleep(30000);
      }
      throw new Error("Timed out waiting for packages to appear on npm");
    };

    const rootPackageJson = require(`../../../../../package.json`);
    const { workspaces, ...rootWithoutWorkspaces } = rootPackageJson;

    // re-establish the state dev:release is in when it reaches the cli step:
    // cli package.json updated and workspaces removed from the root, so the
    // cli installs the published @saltcorn packages rather than local links
    updatePkgJson("saltcorn-cli");
    fs.writeFileSync(
      `package.json`,
      JSON.stringify(rootWithoutWorkspaces, null, 2)
    );

    await waitForRegistry();
    runCmd("npm", ["cache", "clean", "--force"], {
      stdio: "inherit",
      cwd: `.`,
    });

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
    await publish("saltcorn-cli", tag);
    fs.writeFileSync(
      `package.json`,
      JSON.stringify(
        {
          ...rootWithoutWorkspaces,
          workspaces: workspaces || ["./packages/*"],
        },
        null,
        2
      )
    );
    // update Dockerfile
    for (const dockerfileName of [
      `Dockerfile.release`,
      `Dockerfile.mobile.release`,
      `Dockerfile.isolated.release`,
    ]) {
      const dockerfile = fs.readFileSync(dockerfileName, "utf8");
      fs.writeFileSync(
        dockerfileName,
        dockerfile.replace(/cli@.* --omit=dev/, `cli@${version} --omit=dev`)
      );
    }
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
ReleaseResumeCommand.description = `Resume a failed release at the cli publish step`;

/**
 * @type {object}
 */
ReleaseResumeCommand.args = {
  version: Args.string({
    required: true,
    description: "New version number",
  }),
  tag: Args.string({
    required: false,
    description: "NPM tag to give this release (default: next)",
  }),
};

ReleaseResumeCommand.flags = {
  tag: Flags.string({
    char: "t",
    description: "NPM tag (alternative to the tag argument)",
  }),
};
module.exports = ReleaseResumeCommand;
