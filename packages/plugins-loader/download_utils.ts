import fs from "fs";
import { createWriteStream } from "fs";
import fsExtra from "fs-extra";
import { tmpName } from "tmp-promise";
import { execFileSync } from "child_process";
import { extract } from "tar";
import { join } from "path";
import { get } from "https";
import type { IncomingMessage } from "http";
import npmFetch from "npm-registry-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

const { rm } = fs.promises;
const { mkdir, pathExists } = fsExtra;

/**
 * minimal shape of a plugin used by the download helpers
 */
export type PluginObj = {
  name: string;
  location: string;
  version?: string;
  source?: string;
  deploy_private_key?: string;
  [key: string]: any;
};

export const getFetchProxyOptions = (): { agent?: HttpsProxyAgent<string> } => {
  if (process.env["HTTPS_PROXY"]) {
    const agent = new HttpsProxyAgent(process.env["HTTPS_PROXY"]);
    return { agent };
  } else return {};
};

export const downloadFromGithub = async (
  plugin: PluginObj,
  rootFolder: string,
  pluginDir: string
): Promise<void> => {
  const tarballUrl = `https://api.github.com/repos/${plugin.location}/tarball`;
  const fileName = plugin.name.split("/").pop()!;
  const filePath = await loadTarball(rootFolder, tarballUrl, fileName);
  await mkdir(pluginDir, { recursive: true });
  await extractTarball(filePath, pluginDir);
};

export const downloadFromNpm = async (
  plugin: PluginObj,
  rootFolder: string,
  pluginDir: string,
  pckJson: any
): Promise<boolean> => {
  const pkgInfo = await npmFetch.json(
    `https://registry.npmjs.org/${plugin.location}`,
    getFetchProxyOptions()
  );
  const keys = Object.keys(pkgInfo.versions);
  const latest = keys[keys.length - 1];
  const vToInstall =
    plugin.version && plugin.version !== "latest" ? plugin.version : latest;

  if (pckJson && pckJson.version === vToInstall) return false;
  else {
    const tarballUrl = pkgInfo.versions[vToInstall].dist.tarball;
    const fileName = plugin.name.split("/").pop()!;
    const filePath = await loadTarball(rootFolder, tarballUrl, fileName);
    await mkdir(pluginDir, { recursive: true });
    await extractTarball(filePath, pluginDir);
    return true;
  }
};

export const loadTarball = (
  rootFolder: string,
  url: string,
  name: string
): Promise<string> => {
  const options: any = {
    headers: {
      "User-Agent": "request",
    },
    ...getFetchProxyOptions(),
  };
  const writeTarball = async (res: IncomingMessage): Promise<string> => {
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
        get(res.headers.location!, options, async (redirect) => {
          if (redirect.statusCode === 200) {
            const filePath = await writeTarball(redirect);
            resolve(filePath);
          } else
            reject(
              new Error(
                `Error downloading tarball from ${url}: http code ${redirect.statusCode}`
              )
            );
        });
      } else if (res.statusCode !== 200)
        reject(
          new Error(
            `Error downloading tarball from ${url}: http code ${res.statusCode}`
          )
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
export const gitPullOrClone = async (
  plugin: PluginObj,
  pluginDir: string
): Promise<void> => {
  let keyfnm: string | undefined,
    setKey = [
      "-c",
      `core.sshCommand="ssh -oBatchMode=yes -o 'StrictHostKeyChecking no'"`,
    ];
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
    setKey = [
      "-c",
      `core.sshCommand="ssh -oBatchMode=yes -o 'StrictHostKeyChecking no' -i ${keyfnm}"`,
    ];
  }
  if (fs.existsSync(pluginDir)) {
    execFileSync("git", [...setKey, "-C", pluginDir, "pull"]);
  } else {
    execFileSync("git", [...setKey, "clone", plugin.location, pluginDir]);
  }
  if (plugin.deploy_private_key && keyfnm) await fs.promises.unlink(keyfnm);
};

export const extractTarball = async (
  tarFile: string,
  destination: string
): Promise<void> => {
  await extract({
    file: tarFile,
    cwd: destination,
    strip: 1,
  });
};

export const tarballExists = async (
  rootFolder: string,
  plugin: PluginObj
): Promise<boolean> => {
  const fileName = `${plugin.name.split("/").pop()}.tar.gz`;
  return await pathExists(join(rootFolder, "plugins_folder", fileName));
};

export const removeTarball = async (
  rootFolder: string,
  plugin: PluginObj
): Promise<void> => {
  const fileName = `${plugin.name.split("/").pop()}.tar.gz`;
  await rm(join(rootFolder, "plugins_folder", fileName));
};
