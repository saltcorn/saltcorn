const fs = require("fs");
const { tmpName } = require("tmp-promise");
const { execSync } = require("child_process");
const { extract } = require("tar");
const { join } = require("path");
const { createWriteStream, unlink } = require("fs");
const https = require("https");
const npmFetch = require("npm-registry-fetch");

const projectRoot = join(__dirname, "..", "..", ".."); // TODO only tested in dev mode

const downloadTarball = async (plugin) => {
  const url = await npmUrl(plugin);
  const filePath = join(projectRoot, "plugins_folder", `${plugin.name}.tar.gz`);
  const file = createWriteStream(filePath);
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve(filePath);
        });
      })
      .on("error", (err) => {
        unlink("tarball.tar.gz", () => {});
        reject(err);
      });
  });
};

/**
 * Git pull or clone
 * @param plugin
 */
const gitPullOrClone = async (plugin) => {
  await fs.promises.mkdir("git_plugins", { recursive: true });
  let keyfnm,
    setKey = `-c core.sshCommand="ssh -oBatchMode=yes -o 'StrictHostKeyChecking no'" `;
  if (plugin.deploy_private_key) {
    keyfnm = await tmpName();
    await fs.promises.writeFile(
      keyfnm,
      plugin.deploy_private_key.replace(/[\r]+/g, "") + "\n",
      {
        mode: 0o600,
        encoding: "ascii",
      }
    );
    setKey = `-c core.sshCommand="ssh -oBatchMode=yes -o 'StrictHostKeyChecking no' -i ${keyfnm}" `;
  }
  const dir = `git_plugins/${plugin.name}`;
  if (fs.existsSync(dir)) {
    execSync(`git ${setKey} -C ${dir} pull`);
  } else {
    execSync(`git ${setKey} clone ${plugin.location} ${dir}`);
  }
  if (plugin.deploy_private_key && keyfnm) await fs.promises.unlink(keyfnm);
  return dir;
};

const extractTarball = async (tarFile, destination) => {
  await extract({
    file: tarFile,
    cwd: destination,
    strip: 1,
  });
};

const npmUrl = async (plugin) => {
  let version = null;
  if (plugin.version && plugin.version !== "latest") version = plugin.version;
  else version = await latestVersion(plugin);
  return `https://registry.npmjs.org/${plugin.location}/-/${plugin.name}-${version}.tgz`;
};

const latestVersion = async (plugin) => {
  const pkgInfo = await npmFetch.json(
    `https://registry.npmjs.org/${plugin.location}`
  );
  if (!pkgInfo.versions) throw new Error("No versions found");
  // @ts-ignore
  const keys = Object.keys(pkgInfo.versions);
  return keys[keys.length - 1];
};

module.exports = {
  downloadTarball,
  gitPullOrClone,
  extractTarball,
  npmUrl,
  latestVersion,
};
