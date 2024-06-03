const fs = require("fs");
const { rm } = require("fs").promises;
const { mkdir, pathExists } = require("fs-extra");
const { tmpName } = require("tmp-promise");
const { execSync } = require("child_process");
const { extract } = require("tar");
const { join } = require("path");
const { createWriteStream, unlink } = require("fs");
const { get } = require("https");
const npmFetch = require("npm-registry-fetch");

const downloadFromGithub = async (plugin, rootFolder, pluginDir) => {
  const tarballUrl = `https://api.github.com/repos/${plugin.location}/tarball`;
  const fileName = plugin.name.split("/").pop();
  const filePath = await loadTarball(rootFolder, tarballUrl, fileName);
  await mkdir(pluginDir, { recursive: true });
  await extractTarball(filePath, pluginDir);
};

const downloadFromNpm = async (plugin, rootFolder, pluginDir, pckJson) => {
  const pkgInfo = await npmFetch.json(
    `https://registry.npmjs.org/${plugin.location}`
  );
  const keys = Object.keys(pkgInfo.versions);
  const latest = keys[keys.length - 1];
  const vToInstall =
    plugin.version && plugin.version !== "latest" ? plugin.version : latest;

  if (pckJson && pckJson.version === vToInstall) return false;
  else {
    const tarballUrl = pkgInfo.versions[vToInstall].dist.tarball;
    const fileName = plugin.name.split("/").pop();
    const filePath = await loadTarball(rootFolder, tarballUrl, fileName);
    await mkdir(pluginDir, { recursive: true });
    await extractTarball(filePath, pluginDir);
    return true;
  }
};

const loadTarball = (rootFolder, url, name) => {
  const options = {
    headers: {
      "User-Agent": "request",
    },
  };
  const writeTarball = async (res) => {
    const filePath = join(rootFolder, "plugins_folder", `${name}.tar.gz`);
    const stream = createWriteStream(filePath);
    res.pipe(stream);
    return new Promise((resolve, reject) => {
      stream.on("finish", () => {
        stream.close();
        resolve(filePath);
      });
      stream.on("error", (err) => {
        stream.close();
        reject(err);
      });
    });
  };

  return new Promise((resolve, reject) => {
    get(url, options, async (res) => {
      if (res.statusCode === 302) {
        get(res.headers.location, options, async (redirect) => {
          if (redirect.statusCode === 200) {
            const filePath = await writeTarball(redirect);
            resolve(filePath);
          } else
            reject(
              new Error(
                `Error downloading tarball: http code ${redirect.statusCode}`
              )
            );
        });
      } else if (res.statusCode !== 200)
        reject(
          new Error(`Error downloading tarball: http code ${res.statusCode}`)
        );
      else {
        const filePath = await writeTarball(res);
        resolve(filePath);
      }
    }).on("error", (err) => {
      reject(err);
    });
  });
};

/**
 * Git pull or clone
 * @param plugin
 */
const gitPullOrClone = async (plugin, pluginDir) => {
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
  if (fs.existsSync(pluginDir)) {
    execSync(`git ${setKey} -C ${pluginDir} pull`);
  } else {
    execSync(`git ${setKey} clone ${plugin.location} ${pluginDir}`);
  }
  if (plugin.deploy_private_key && keyfnm) await fs.promises.unlink(keyfnm);
};

const extractTarball = async (tarFile, destination) => {
  await extract({
    file: tarFile,
    cwd: destination,
    strip: 1,
  });
};

const tarballExists = async (rootFolder, plugin) => {
  const fileName = `${plugin.name.split("/").pop()}.tar.gz`;
  return await pathExists(join(rootFolder, "plugins_folder", fileName));
};

const removeTarball = async (rootFolder, plugin) => {
  const fileName = `${plugin.name.split("/").pop()}.tar.gz`;
  await rm(join(rootFolder, "plugins_folder", fileName));
};

module.exports = {
  downloadFromGithub,
  downloadFromNpm,
  gitPullOrClone,
  loadTarball,
  extractTarball,
  tarballExists,
  removeTarball,
};
