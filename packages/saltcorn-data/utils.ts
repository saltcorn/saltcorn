/**
 * @category saltcorn-data
 * @module utils
 */
import { serialize, deserialize } from "v8";
import { createReadStream } from "fs";
import { GenObj } from "@saltcorn/types/common_types";
import { Where } from "@saltcorn/db-common/internal";

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
  return deserialize(serialize(obj));
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

const sat1 = (obj: any, [k, v]: [k: string, v: any]) =>
  v && v.or
    ? v.or.some((v1: any) => sat1(obj, [k, v1]))
    : v && v.in
    ? v.in.includes(obj[k])
    : obj[k] === v;

const satisfies = (where: Where) => (obj: any) =>
  Object.entries(where || {}).every((kv) => sat1(obj, kv));

// https://gist.github.com/jadaradix/fd1ef195af87f6890448
const getLines = (filename: string, lineCount: number) =>
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

const prefixFieldsInWhere = (inputWhere: GenObj, tablePrefix: string) => {
  if (!inputWhere) return {};
  const whereObj: GenObj = {};
  Object.keys(inputWhere).forEach((k) => {
    if (k === "_fts") whereObj[k] = { table: tablePrefix, ...inputWhere[k] };
    else if (k === "not") {
      whereObj.not = prefixFieldsInWhere(inputWhere[k], tablePrefix);
    } else whereObj[`${tablePrefix}."${k}"`] = inputWhere[k];
  });
  return whereObj;
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

export = {
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
  satisfies,
  getLines,
  removeAllWhiteSpace,
  sleep,
  mergeIntoWhere,
  isStale,
};
