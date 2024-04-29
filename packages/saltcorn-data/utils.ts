/**
 * @category saltcorn-data
 * @module utils
 */
import { serialize, deserialize } from "v8";
import { createReadStream } from "fs";
import { GenObj, instanceOfType } from "@saltcorn/types/common_types";
import { Row, Where, prefixFieldsInWhere } from "@saltcorn/db-common/internal";
import type { ConnectedObjects } from "@saltcorn/types/base_types";
import crypto from "crypto";
import { join, dirname } from "path";
import type Field from "./models/field"; // only type, shouldn't cause require loop
const _ = require("underscore");

const removeEmptyStrings = (obj: GenObj) => {
  var o: GenObj = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== "" && v !== null) o[k] = v;
  });
  return o;
};
const removeDefaultColor = (obj: GenObj) => {
  var o: GenObj = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== "#000000") o[k] = v;
  });
  return o;
};
const isEmpty = (o: GenObj) => Object.keys(o).length === 0;

const asyncMap = async (xs: any[], asyncF: Function) => {
  var res = [];
  var ix = 0;
  for (const x of xs) {
    res.push(await asyncF(x, ix));
    ix += 1;
  }
  return res;
};

const numberToBool = (b: boolean): number | boolean =>
  typeof b === "number" ? b > 0 : b;

const stringToJSON = (v: string | any): any => {
  try {
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch (e: any) {
    throw new Error(`stringToJSON(${JSON.stringify(v)}): ${e.message}`);
  }
};
const apply = (f: Function | any, x: any) =>
  typeof f === "function" ? f(x) : f;

const applyAsync = async (f: Function | any, x: any) => {
  if (typeof f === "function") return await f(x);
  else return f;
};

const structuredClone = (obj: any) => {
  if (isNode()) return deserialize(serialize(obj));
  else return JSON.parse(JSON.stringify(obj));
};

class InvalidAdminAction extends Error {
  headline: string;
  httpCode: number;
  severity: number;
  constructor(message: string) {
    super(message);
    this.headline = "Invalid administrative action";
    this.httpCode = 406;
    this.severity = 5; //syslog equivalent severity level
  }
}

class InvalidConfiguration extends Error {
  headline: string;
  httpCode: number;
  severity: number;
  constructor(message: string) {
    super(message);
    this.httpCode = 500;
    this.headline = "A configuration error occurred";
    this.severity = 3;
  }
}

class NotAuthorized extends Error {
  headline: string;
  httpCode: number;
  severity: number;
  constructor(message: string) {
    super(message);
    this.httpCode = 401;
    this.headline = "Not Authorized";
    this.severity = 5; //syslog equivalent severity level
  }
}

const sat1 = (obj: any, [k, v]: [k: string, v: any]) =>
  v && v.or
    ? v.or.some((v1: any) => sat1(obj, [k, v1]))
    : v && v.in
    ? v.in.includes(obj[k])
    : obj[k] === v;

const satisfies = (where: Where) => (obj: any) =>
  Object.entries(where || {}).every((kv) => sat1(obj, kv));

// https://gist.github.com/jadaradix/fd1ef195af87f6890448
const getLines = (filename: string, lineCount: number): Promise<string> =>
  new Promise((resolve) => {
    let stream = createReadStream(filename, {
      flags: "r",
      encoding: "utf-8",
      fd: undefined,
      mode: 438, // 0666 in Octal
      // @ts-ignore
      bufferSize: 64 * 1024,
    });

    let data = "";
    let lines: string[] = [];
    stream.on("data", function (moreData) {
      data += moreData;
      lines = data.split("\n");
      // probably that last line is "corrupt" - halfway read - why > not >=
      if (lines.length > lineCount + 1) {
        stream.destroy();
        lines = lines.slice(0, lineCount); // junk as above
        resolve(lines.join("\n"));
      }
    });

    /*stream.on("error", function () {
    callback("Error");
  });*/

    stream.on("end", function () {
      resolve(lines.join("\n"));
    });
  });

const removeAllWhiteSpace = (s: string) =>
  s.replace(/\s+/g, "").split("&nbsp;").join("").split("<hr>").join("");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const mergeIntoWhere = (where: Where, newWhere: GenObj) => {
  Object.entries(newWhere).forEach(([k, v]) => {
    if (typeof where[k] === "undefined") where[k] = v;
    else where[k] = [where[k], v];
  });
  return where;
};

const mergeActionResults = (result: any, stepres: any) => {
  Object.keys(stepres || {}).forEach((k) => {
    if (k === "set_fields") {
      if (!result.set_fields) result.set_fields = {};
      Object.keys(stepres.set_fields || {}).forEach((f) => {
        result.set_fields[f] = stepres.set_fields[f];
      });
    } else if (
      !["notify", "notify_success", "error", "eval_js", "download"].includes(k)
    )
      result[k] = stepres[k];
    else if (Array.isArray(result[k])) result[k].push(stepres[k]);
    else if (typeof result[k] !== "undefined")
      result[k] = [result[k], stepres[k]];
    else result[k] = stepres[k];
  });
};

/**
 * @function
 * @param {Date} date
 * @param {string} [hours = 24]
 * @returns {boolean}
 */
const isStale = (date: Date | string, hours: number = 24): boolean => {
  const oneday = 60 * 60 * hours * 1000;
  let now = new Date();
  return new Date(date).valueOf() < now.valueOf() - oneday;
};

declare const window: any;

/**
 * returns true if it's a node enviroment,
 * false if it's webpack bundled code
 */
const isNode = (): boolean => {
  return typeof window === "undefined";
};

/**
 * returns true if it's node and not a 'saltcorn mobile requeset'
 * a saltcorn mobile request is identified by the smr header
 * @param req express request
 */
const isWeb = (req: any): boolean => {
  return isNode() && !req?.smr;
};

/**
 * returns the session id
 * @param req express request
 */

const getSessionId = (req: any): string => {
  return req?.sessionID || req?.cookies?.["express:sess"];
};

/**
 * @returns true if the mobile offline mode is active
 */
const isOfflineMode = (): boolean => {
  const state = require("./db/state").getState();
  return !isNode() && state.mobileConfig?.isOfflineMode;
};

/**
 * merges the arrays from 'lhs' and 'rhs'
 * @param lhs
 * @param rhs
 * @returns instance with merged arrays
 */
const mergeConnectedObjects = (
  lhs: ConnectedObjects,
  rhs: ConnectedObjects
): ConnectedObjects => {
  const merge = (arrOne: any, arrTwo: any) => [
    ...(arrOne ? arrOne : []),
    ...(arrTwo ? arrTwo : []),
  ];
  return {
    linkedViews: merge(lhs.linkedViews, rhs.linkedViews),
    embeddedViews: merge(lhs.embeddedViews, rhs.embeddedViews),
    linkedPages: merge(lhs.linkedPages, rhs.linkedPages),
    tables: merge(lhs.tables, rhs.tables),
  };
};

const objectToQueryString = (o: Object): string =>
  Object.entries(o || {})
    .map(([k, v]: any) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

const urlStringToObject = (url: string): any => {
  if (!url) return {};
  const noHash = url.split("#")[0];
  const qs = noHash.split("?")[1];
  if (!qs) return {};
  const parsedQuery = new URLSearchParams(qs);
  const result: any = {};
  if (parsedQuery) {
    for (let [key, value] of parsedQuery) {
      result[key] = value;
    }
  }
  return result;
};

/**
 * create a hash from a state object so that views with identical type can be uniquely identified
 * "_page", "_pagesize", "_sortby", "_sortdesc" are ecxluded
 * @param state
 * @param viewname
 * @returns
 */
const hashState = (state: any, viewname: string): string => {
  const excluded = ["_page", "_pagesize", "_sortby", "_sortdesc"];
  const include = (k: string) => !excluded.some((val) => k.endsWith(val));
  const filteredState: any = {};
  for (const [k, v] of Object.entries(state)) {
    if (include(k)) filteredState[k] = v;
  }
  const stringToHash = `${viewname}:${objectToQueryString(filteredState)}`;
  const hash = crypto.createHash("sha1").update(stringToHash).digest("hex");
  return hash.substring(0, 5);
};

const extractPagings = (state: any): any => {
  const result: any = {};
  for (const [k, v] of Object.entries(state)) {
    if (k.endsWith("_page") || k.endsWith("_pagesize")) {
      result[k] = v;
    }
  }
  return result;
};

/**
 * create a sha1 hash from a string
 * @param s string to hash
 * @returns sha1 hash
 */
const hashString = (s: string): string => {
  return crypto.createHash("sha1").update(s).digest("hex");
};

/**
 * check if 'saltcorn' is in the PATH env or build a full path
 * @returns string ready to use for spawn
 */
const getSafeSaltcornCmd = () => {
  return process.env.PATH!.indexOf("saltcorn-cli/bin") > 0
    ? "saltcorn"
    : process.env.JEST_WORKER_ID === undefined
    ? join(dirname(require!.main!.filename), "saltcorn")
    : join(
        dirname(require!.main!.filename),
        "..",
        "..",
        "saltcorn-cli",
        "bin",
        "saltcorn"
      );
};

/**
 * get base_url config without ending slash
 * @returns url or empty string
 */
const getSafeBaseUrl = () => {
  const path = require("./db/state").getState().getConfig("base_url");
  return !path
    ? ""
    : path.endsWith("/")
    ? path.substring(0, path.length - 1)
    : path;
};

/**
 * @param str
 * @returns
 */
const removeNonWordChars = (str: string) => {
  return str.replace(/[\W_]+/g, "");
};
const nubBy = (prop: string, xs: any[]) => {
  const vs = new Set();
  return xs.filter((x) => {
    if (vs.has(x[prop])) return false;
    vs.add(x[prop]);
    return true;
  });
};
// add a $ in front of every key
const dollarizeObject = (state: object) =>
  Object.fromEntries(Object.entries(state).map(([k, v]) => [`$${k}`, v]));

/**
 * @returns true if the NODE_ENV is 'test'
 */
const isTest = () => process.env.NODE_ENV === "test";

/**
 * Compare objects (for Array.sort) by property name or function
 */
const comparing = (f: ((o: any) => any) | string) => (a: any, b: any) => {
  const fa = typeof f === "string" ? a[f] : f(a);
  const fb = typeof f === "string" ? b[f] : f(b);
  return fa > fb ? 1 : fb > fa ? -1 : 0;
};

const comparingCaseInsensitive = (k: string) => (a: any, b: any) => {
  const fa = a[k]?.toLowerCase?.();
  const fb = b[k]?.toLowerCase?.();
  return fa > fb ? 1 : fb > fa ? -1 : 0;
};

const ppVal = (x: any) =>
  typeof x === "string"
    ? x
    : typeof x === "function"
    ? x.toString()
    : JSON.stringify(x, null, 2);

const interpolate = (s: string, row: any, user?: any) => {
  if (s && typeof s === "string") {
    const template = _.template(s, {
      interpolate: /\{\{!(.+?)\}\}/g,
      escape: /\{\{([^!].+?)\}\}/g,
    });
    return template({ row, user, ...(row || {}) });
  } else return s;
};

const prepMobileRows = (rows: Row[], fields: Field[]) => {
  const dateFields = fields.filter(
    (f) => instanceOfType(f.type) && f.type?.name === "Date"
  );
  if (dateFields.length === 0) return rows;
  else {
    const dateFieldNames = dateFields.map((f: any) => f.name);
    return rows.map((row) => {
      const newRow = { ...row };
      for (const fn of dateFieldNames) {
        if (newRow[fn]) newRow[fn] = new Date(newRow[fn]);
      }
      return newRow;
    });
  }
};

export = {
  dollarizeObject,
  objectToQueryString,
  removeEmptyStrings,
  removeDefaultColor,
  prefixFieldsInWhere,
  isEmpty,
  asyncMap,
  numberToBool,
  stringToJSON,
  applyAsync,
  apply,
  structuredClone,
  InvalidAdminAction,
  InvalidConfiguration,
  NotAuthorized,
  satisfies,
  getLines,
  removeAllWhiteSpace,
  sleep,
  mergeIntoWhere,
  isStale,
  isNode,
  isWeb,
  isOfflineMode,
  mergeConnectedObjects,
  hashState,
  hashString,
  extractPagings,
  getSafeSaltcornCmd,
  getSafeBaseUrl,
  removeNonWordChars,
  nubBy,
  isTest,
  getSessionId,
  mergeActionResults,
  urlStringToObject,
  comparing,
  comparingCaseInsensitive,
  ppVal,
  interpolate,
  prepMobileRows,
};
