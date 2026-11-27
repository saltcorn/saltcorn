/**
 * Structural diff between two packs (e.g. two snapshots, or a snapshot
 * and the current application).
 *
 * Items are matched by identity (name, or id for roles), not by position,
 * so reordering does not show up as a change. null, undefined, missing
 * and empty containers are treated as equal.
 * @category saltcorn-admin-models
 * @module models/pack_diff
 */
import * as config from "@saltcorn/data/models/config";
import type { Pack } from "@saltcorn/types/base_types";
const { configTypes } = config;

export type ChangeKind = "added" | "removed" | "changed";

/** One change inside an item. An empty path means the item value itself. */
export type PathChange = {
  path: string;
  kind: ChangeKind;
  /** omitted for secret values */
  old?: any;
  /** omitted for secret values */
  new?: any;
};

export type SectionDiff = {
  added: string[];
  removed: string[];
  changed: { name: string; changes: PathChange[] }[];
};

export type PackDiff = {
  /** only sections with at least one change */
  sections: Record<string, SectionDiff>;
  summary: { added: number; removed: number; changed: number };
};

/** Display order of sections; unknown sections follow alphabetically */
const SECTION_ORDER = [
  "tables",
  "views",
  "pages",
  "page_groups",
  "triggers",
  "code_pages",
  "roles",
  "plugins",
  "library",
  "tags",
  "models",
  "config",
];

/** Not carried in snapshots */
const SKIP_SECTIONS = new Set(["event_logs", "model_instances"]);

/** Keys whose values are never put in the diff output */
const SECRET_KEYS = new Set(["deploy_private_key"]);

const isSecretConfig = (key: string): boolean =>
  (configTypes as any)[key]?.input_type === "password";

const isNil = (v: any): boolean => v === null || v === undefined;

/**
 * Values that mean "not set". false and "" are included so a newly
 * introduced flag (e.g. system_rows: false) or an empty description
 * does not show as a change against packs that lack the key.
 */
const isUnset = (v: any): boolean => isNil(v) || v === false || v === "";

const isPlainObject = (v: any): boolean =>
  !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);

/** JSON with sorted object keys, for order-independent identity */
const stableStringify = (v: any): string => {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (isPlainObject(v))
    return `{${Object.keys(v)
      .sort()
      .filter((k) => !isNil(v[k]))
      .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
      .join(",")}}`;
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  return JSON.stringify(v);
};

const joinPath = (path: string, seg: string): string =>
  path ? `${path}.${seg}` : seg;

/**
 * How to identify the elements of an array, or null to compare by position.
 * Uses name, then id (id first for table rows), if every element has a
 * unique one; constraints are identified by type + configuration.
 */
const arrayKeyFn = (
  parentKey: string,
  a: any[],
  b: any[]
): ((x: any) => string) | null => {
  const all = [...a, ...b];
  if (all.length === 0 || !all.every(isPlainObject)) return null;
  const uniqueIn = (arr: any[], f: (x: any) => any) =>
    new Set(arr.map(f)).size === arr.length;
  // table rows are identified by primary key, even if they have a name column
  const idKeys = parentKey === "rows" ? ["id", "name"] : ["name", "id"];
  for (const k of idKeys) {
    const f = (x: any) => x[k];
    if (
      all.every((x) => !isNil(x[k]) && x[k] !== "") &&
      uniqueIn(a, f) &&
      uniqueIn(b, f)
    )
      return (x: any) => String(x[k]);
  }
  if (parentKey === "constraints") {
    const f = (x: any) => `${x.type}:${stableStringify(x.configuration)}`;
    if (uniqueIn(a, f) && uniqueIn(b, f)) return f;
  }
  return null;
};

const lastSegment = (path: string): string => {
  const m = path.match(/([^.[\]]+)(?:\[\d+\])?$/);
  return m ? m[1] : "";
};

const isEmptyContainer = (v: any): boolean =>
  (Array.isArray(v) && v.length === 0) ||
  (isPlainObject(v) && Object.keys(v).every((k) => isUnset(v[k])));

/** Recursively collect the changes between two values */
const diffValues = (
  a: any,
  b: any,
  path: string,
  out: PathChange[],
  secret: boolean
): void => {
  if (a instanceof Date) a = a.toISOString();
  if (b instanceof Date) b = b.toISOString();
  if (
    (isUnset(a) || isEmptyContainer(a)) &&
    (isUnset(b) || isEmptyContainer(b))
  )
    return;

  const push = (kind: ChangeKind): void => {
    out.push(
      secret
        ? { path, kind }
        : {
            path,
            kind,
            ...(kind !== "added" ? { old: a } : {}),
            ...(kind !== "removed" ? { new: b } : {}),
          }
    );
  };

  if (isNil(a)) return push("added");
  if (isNil(b)) return push("removed");

  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const k of keys)
      diffValues(
        a[k],
        b[k],
        joinPath(path, k),
        out,
        secret || SECRET_KEYS.has(k)
      );
    return;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const keyFn = arrayKeyFn(lastSegment(path), a, b);
    if (keyFn) {
      const am = new Map(a.map((x) => [keyFn(x), x]));
      const bm = new Map(b.map((x) => [keyFn(x), x]));
      const keys = [...new Set([...am.keys(), ...bm.keys()])];
      for (const k of keys)
        diffValues(am.get(k), bm.get(k), joinPath(path, k), out, secret);
    } else {
      const n = Math.max(a.length, b.length);
      for (let i = 0; i < n; i++)
        diffValues(a[i], b[i], `${path}[${i}]`, out, secret);
    }
    return;
  }

  if (stableStringify(a) !== stableStringify(b)) push("changed");
};

/** Diff two arrays of named items (or roles, by id) */
const diffItemSection = (section: string, a: any[], b: any[]): SectionDiff => {
  const idKey = section === "roles" ? "id" : "name";
  const label = (x: any) => String(section === "roles" ? x.role : x.name);
  const toMap = (arr: any[]) =>
    new Map(
      arr
        .filter((x) => isPlainObject(x) && !isNil(x[idKey]))
        .map((x) => [String(x[idKey]), x])
    );
  const am = toMap(a);
  const bm = toMap(b);
  const result: SectionDiff = { added: [], removed: [], changed: [] };
  for (const [k, item] of am) if (!bm.has(k)) result.removed.push(label(item));
  for (const [k, item] of bm) {
    const old = am.get(k);
    if (!old) {
      result.added.push(label(item));
      continue;
    }
    const changes: PathChange[] = [];
    diffValues(old, item, "", changes, false);
    if (changes.length) result.changed.push({ name: label(item), changes });
  }
  return result;
};

/** Diff the config object, key by key */
const diffConfigSection = (a: any, b: any): SectionDiff => {
  const result: SectionDiff = { added: [], removed: [], changed: [] };
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const k of keys) {
    // only a truly missing key is added/removed; false or "" vs missing
    // is no change, and false vs true is a change
    if (isNil(a[k]) && !isUnset(b[k])) result.added.push(k);
    else if (isNil(b[k]) && !isUnset(a[k])) result.removed.push(k);
    else {
      const changes: PathChange[] = [];
      diffValues(a[k], b[k], "", changes, isSecretConfig(k));
      if (changes.length) result.changed.push({ name: k, changes });
    }
  }
  return result;
};

const parsePack = (p: Pack | string | null | undefined): any =>
  typeof p === "string" ? JSON.parse(p) : p || {};

/**
 * Compute the structural difference between two packs
 * @param oldPack the "before" pack (object or JSON string)
 * @param newPack the "after" pack (object or JSON string)
 */
const diff_packs = (
  oldPack: Pack | string | null | undefined,
  newPack: Pack | string | null | undefined
): PackDiff => {
  const a = parsePack(oldPack);
  const b = parsePack(newPack);
  const sectionNames = [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((s) => !SKIP_SECTIONS.has(s))
    .sort((x, y) => {
      const ix = SECTION_ORDER.indexOf(x);
      const iy = SECTION_ORDER.indexOf(y);
      if (ix >= 0 && iy >= 0) return ix - iy;
      if (ix >= 0) return -1;
      if (iy >= 0) return 1;
      return x.localeCompare(y);
    });

  const sections: Record<string, SectionDiff> = {};
  const summary = { added: 0, removed: 0, changed: 0 };
  for (const s of sectionNames) {
    const av = a[s];
    const bv = b[s];
    let sd: SectionDiff;
    if ((Array.isArray(av) || isNil(av)) && (Array.isArray(bv) || isNil(bv)))
      sd = diffItemSection(s, av || [], bv || []);
    else if (
      (isPlainObject(av) || isNil(av)) &&
      (isPlainObject(bv) || isNil(bv))
    )
      sd = diffConfigSection(av || {}, bv || {});
    else continue; // unknown shape
    if (sd.added.length || sd.removed.length || sd.changed.length) {
      sections[s] = sd;
      summary.added += sd.added.length;
      summary.removed += sd.removed.length;
      summary.changed += sd.changed.length;
    }
  }
  return { sections, summary };
};

export { diff_packs };
export default { diff_packs };
