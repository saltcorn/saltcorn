import db from "@saltcorn/data/db/index";
import utils = require("@saltcorn/data/utils");
const { getSafeSaltcornCmd } = utils;
import { join } from "path";
import {
  existsSync,
  mkdirSync,
  copySync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "fs-extra";
import { Row } from "@saltcorn/db-common/internal";
import { spawnSync, execSync } from "child_process";
import Page from "@saltcorn/data/models/page";
import File from "@saltcorn/data/models/file";
import type User from "@saltcorn/data/models/user";
import { getState } from "@saltcorn/data/db/state";
import type { PluginLayout } from "@saltcorn/types/base_types";
import { parseStringPromise, Builder } from "xml2js";

const resizer = require("resize-with-sharp-or-jimp");

export function copyKeyStore(buildDir: string, keyStorePath: string) {
  copySync(keyStorePath, join(buildDir, "myapp.keystore"));
  return "myapp.keystore";
}

/**
 * copy saltcorn-mobile-app as a template to buildDir
 * @param buildDir directory where the app will be build
 * @param templateDir directory of the template code that will be copied to 'buildDir'
 */
export function prepareBuildDir(buildDir: string, templateDir: string) {
  if (existsSync(buildDir)) rmSync(buildDir, { force: true, recursive: true });
  copySync(templateDir, buildDir);
  rmSync(`${buildDir}/node_modules`, { recursive: true, force: true });
  const result = spawnSync("npm", ["install", "--legacy-peer-deps"], {
    cwd: buildDir,
  });
  console.log(result.output.toString());
}

export async function modifyConfigXml(buildDir: string, config: any) {
  try {
    const configXml = join(buildDir, "config.xml");
    const content = readFileSync(configXml);
    const parsed = await parseStringPromise(content);
    if (config.appName) parsed.widget.name[0] = config.appName;
    if (config.appId) parsed.widget.$.id = config.appId;
    if (config.appVersion) parsed.widget.$.version = config.appVersion;
    const xmlBuilder = new Builder();
    const newCfg = xmlBuilder.buildObject(parsed);
    writeFileSync(configXml, newCfg);
  } catch (error: any) {
    console.log(
      `Unable to modify the config.xml: ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * copy a png file into the build dir and use it as launcher icon
 * @param buildDir
 * @param appIcon path to appIcon file
 */
export async function prepareAppIcon(
  buildDir: string,
  appIcon: string,
  platforms: string[]
) {
  try {
    if (platforms.includes("android"))
      copySync(appIcon, join(buildDir, "res", "icon", "android", "icon.png"), {
        overwrite: true,
      });
    if (platforms.includes("ios")) await prepareAppIconSet(buildDir, appIcon);
  } catch (error: any) {
    console.log(
      `Unable to set the app icon '${appIcon}': ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

async function prepareAppIconSet(buildDir: string, appIcon: string) {
  console.log("prepareAppIconSet", buildDir, appIcon);
  const dir = join(buildDir, "AppIcon.appiconset");
  mkdirSync(dir);
  const contentsJSON = { images: new Array<any>() };
  try {
    for (const { size, scale, idiom } of [
      { size: 29, scale: 1, idiom: "iphone" },
      { size: 20, scale: 2, idiom: "iphone" },
      { size: 40, scale: 2, idiom: "iphone" },
      { size: 57, scale: 1, idiom: "iphone" },
      { size: 60, scale: 2, idiom: "iphone" },
      { size: 1024, scale: 1, idiom: "ios-marketing" },
    ]) {
      const scaledSize = size * scale;
      const fileName = `${size}x${scale}.png`;
      await resizer({
        fromFileName: appIcon,
        width: scaledSize,
        height: scaledSize,
        toFileName: join(dir, fileName),
      });
      contentsJSON.images.push({
        size: `${size}x${size}`,
        idiom: idiom,
        filename: fileName,
        "expected-size": scaledSize,
        scale: `${scale}x`,
      });
    }
    writeFileSync(join(dir, "Contents.json"), JSON.stringify(contentsJSON));
  } catch (error: any) {
    console.log(
      `Unable to generate appicon set for '${appIcon}': ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

export function prepareExportOptionsPlist(
  buildDir: string,
  appId: string,
  provisioningProfile: string
) {
  try {
    const exportOptionsPlist = join(buildDir, "ExportOptions.plist");
    writeFileSync(
      exportOptionsPlist,
      `<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "~//Apple/DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
        <dict>
          <key>method</key>
          <string>app-store-connect</string>
          <key>provisioningProfiles</key>
          <dict>          
            <key>${appId}</key>
            <string>${provisioningProfile}</string>
          </dict>
        </dict>

      </plist>`
    );
  } catch (error: any) {
    console.log(
      `Unable to set the provisioning profile '${provisioningProfile}': ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

export async function decodeProvisioningProfile(
  buildDir: string,
  provisioningProfile: string
) {
  console.log("decodeProvisioningProfile", buildDir, provisioningProfile);
  const outFile = join(buildDir, "provisioningProfile.xml");
  try {
    execSync(`security cms -D -i "${provisioningProfile}" > ${outFile}`);
    const content = readFileSync(outFile);
    const parsed = await parseStringPromise(content);
    const dict = parsed.plist.dict[0];
    const guuid = dict.string[dict.string.length - 1];
    const teamId = dict.array[0].string[0];
    return { guuid, teamId };
  } catch (error: any) {
    console.log(
      `Unable to decode the provisioning profile '${provisioningProfile}': ${
        error.message ? error.message : "Unknown error"
      }`
    );
    throw error;
  }  
}

/**
 * copy files from 'server/public' into the www folder (with a version_tag prefix)
 * @param buildDir directory where the app will be build
 */
export function copyServerFiles(buildDir: string) {
  const wwwDir = join(buildDir, "www");
  // assets
  const assetsDst = join(wwwDir, "static_assets", db.connectObj.version_tag);
  if (!existsSync(assetsDst)) {
    mkdirSync(assetsDst, { recursive: true });
  }
  const serverRoot = join(require.resolve("@saltcorn/server"), "..");
  const srcPrefix = join(serverRoot, "public");
  const srcAssests = [
    "jquery-3.6.0.min.js",
    "saltcorn-common.js",
    "saltcorn.js",
    "saltcorn.css",
    "codemirror.js",
    "codemirror.css",
    "socket.io.min.js",
    "flatpickr.min.css",
    "gridedit.js",
    "flatpickr.min.js",
    "dayjs.min.js",
  ];
  for (const srcFile of srcAssests) {
    copySync(join(srcPrefix, srcFile), join(assetsDst, srcFile));
  }
  // publics
  const srcs = ["flatpickr.min.css", "flatpickr.min.js", "gridedit.js"];
  for (const srcFile of srcs) {
    copySync(join(srcPrefix, srcFile), join(wwwDir, srcFile));
  }
}

/**
 * copy files from 'startbootstrap-sb-admin-2-bs5' into the www directory
 * @param buildDir directory where the app will be build
 */
export function copySbadmin2Deps(buildDir: string) {
  const sbadmin2Dst = join(
    buildDir,
    "www",
    "plugins/pubdeps/sbadmin2/startbootstrap-sb-admin-2-bs5/4.1.5-beta.5"
  );
  if (!existsSync(sbadmin2Dst)) {
    mkdirSync(sbadmin2Dst, { recursive: true });
  }
  const devPath = join(
    __dirname,
    "../../../..",
    "node_modules/startbootstrap-sb-admin-2-bs5"
  );
  const prodPath = join(
    require.resolve("@saltcorn/cli"),
    "../..",
    "node_modules/startbootstrap-sb-admin-2-bs5"
  );
  const srcPrefix = existsSync(devPath) ? devPath : prodPath;
  const srcFiles = [
    "vendor/fontawesome-free",
    "vendor/bootstrap/js/bootstrap.bundle.min.js",
    "vendor/jquery-easing/jquery.easing.min.js",
    "css/sb-admin-2.css",
    "js/sb-admin-2.min.js",
  ];
  for (const srcFile of srcFiles) {
    copySync(join(srcPrefix, srcFile), join(sbadmin2Dst, srcFile));
  }
}

/**
 * Copy the 'site_logo_id' file into the www folder
 * @param buildDir
 * @returns
 */
export async function copySiteLogo(buildDir: string) {
  try {
    const state = getState();
    if (!state) {
      console.log("Unable to get the state object");
    } else {
      await state.refresh_config(true);
      const siteLogo = state?.getConfig("site_logo_id");
      if (siteLogo) {
        const file = await File.findOne(siteLogo);
        if (file) {
          const base64 = readFileSync(file.location, "base64");
          writeFileSync(
            join(buildDir, "www", "encoded_site_logo.txt"),
            `data:${file.mimetype};base64, ${base64}`
          );
        } else {
          console.log(`The file '${siteLogo}' does not exist`);
        }
      }
    }
  } catch (error: any) {
    console.log(
      `Unable to copy the site logo: ${
        error.message ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * create a cfg file, the app use this configs
 * @param param0
 */
export function writeCfgFile({
  buildDir,
  entryPoint,
  entryPointType,
  serverPath,
  localUserTables,
  synchedTables,
  tenantAppName,
  autoPublicLogin,
  allowOfflineMode,
}: any) {
  const wwwDir = join(buildDir, "www");
  let cfg: any = {
    version_tag: db.connectObj.version_tag,
    entry_point: `get/${
      entryPointType === "pagegroup" ? "page" : entryPointType
    }/${entryPoint}`,
    server_path: !serverPath.endsWith("/")
      ? serverPath
      : serverPath.substring(0, serverPath.length - 1),
    localUserTables,
    synchedTables,
    autoPublicLogin,
    allowOfflineMode,
  };
  if (tenantAppName) cfg.tenantAppName = tenantAppName;
  writeFileSync(join(wwwDir, "config"), JSON.stringify(cfg));
}

/**
 * create a file with all data from the db
 * the app updates its local db from this
 * @param buildDir directory where the app will be build
 * @param includedPlugins names of plugins that are bundled into the app
 */
export async function buildTablesFile(
  buildDir: string,
  includedPlugins?: string[]
) {
  const wwwDir = join(buildDir, "www");
  const scTables = (await db.listScTables()).filter(
    (table: Row) =>
      [
        "_sc_migrations",
        "_sc_errors",
        "_sc_session",
        "_sc_event_log",
        "_sc_snapshots",
      ].indexOf(table.name) === -1
  );
  const tablesWithData = await Promise.all(
    scTables.map(async (row: Row) => {
      const dbData = await db.select(row.name);
      return {
        table: row.name,
        rows:
          row.name !== "_sc_plugins"
            ? dbData
            : dbData.filter(
                (plugin: any) =>
                  !includedPlugins || includedPlugins.includes(plugin.name)
              ),
      };
    })
  );
  const createdAt = new Date();
  writeFileSync(
    join(wwwDir, "tables.json"),
    JSON.stringify({
      created_at: createdAt.valueOf(),
      sc_tables: tablesWithData,
    })
  );
  writeFileSync(
    join(wwwDir, "tables_created_at.json"),
    JSON.stringify({
      created_at: createdAt.valueOf(),
    })
  );
}

/**
 * copy files form 'server/locales' into the app
 * @param buildDir directory where the app will be build
 */
export function copyTranslationFiles(buildDir: string) {
  const localesDir = join(require.resolve("@saltcorn/server"), "..", "locales");
  copySync(localesDir, join(buildDir, "www", "locales"));
}

/**
 * init an empty db
 * after the first startup, this db will be updated from the tables.json
 * @param buildDir directory where the app will be build
 */
export async function createSqliteDb(buildDir: string) {
  const result = spawnSync(getSafeSaltcornCmd(), ["add-schema", "-f"], {
    env: {
      ...process.env,
      FORCE_SQLITE: "true",
      SQLITE_FILEPATH: join(buildDir, "www", "scdb.sqlite"),
    },
  });
  if (result.error) {
    console.log(result.error);
    return -1;
  } else {
    console.log(
      result.output
        ? result.output.toString()
        : "'reset-schema' finished without output"
    );
    return result.status;
  }
}

/**
 * Prepare a splash page
 * runs a page and writes the html into 'splash_page.html' of the www directory
 * @param buildDir
 * @param pageName splash page
 * @param serverUrl needed, if 'pageName' uses images from the server
 * @param tenantAppName
 * @param user
 */
export async function prepareSplashPage(
  buildDir: string,
  pageName: string,
  serverUrl: string,
  tenantAppName?: string,
  user?: User
) {
  try {
    const role = user ? user.role_id : 100;
    const page = Page.findOne({ name: pageName });
    if (!page) throw new Error(`The page '${pageName}' does not exist`);
    const state = getState();
    if (!state) throw new Error("Unable to get the state object");
    // @ts-ignore
    global.window = {};
    const contents = await page.run(
      {},
      {
        req: {
          user,
          getLocale: () => {
            return "en";
          },
          isSplashPage: true,
        },
      }
    );
    const sbadmin2 = state.plugins["sbadmin2"];
    const html = (<PluginLayout>sbadmin2.layout).wrap({
      title: page.title,
      body: contents.above ? contents : { above: [contents] },
      alerts: [],
      role: role,
      menu: [],
      headers: [
        { css: `static_assets/${db.connectObj.version_tag}/saltcorn.css` },
        {
          script: `static_assets/${db.connectObj.version_tag}/saltcorn-common.js`,
        },
        { script: `/static_assets/${db.connectObj.version_tag}/dayjs.min.js` },
        { script: "js/utils/iframe_view_utils.js" },
        {
          headerTag: `<script>parent.splashConfig = { server_path: '${serverUrl}', tenantAppName: ${tenantAppName}, };</script>`,
        },
      ],
      brand: { name: "" },
      bodyClass: "",
      currentUrl: "",
    });
    // @ts-ignore
    global.window = undefined;
    writeFileSync(join(buildDir, "www", "splash_page.html"), html);
  } catch (error) {
    console.log("Unable to build a splash page");
    console.log(error);
  }
}
