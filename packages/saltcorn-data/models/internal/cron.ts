/**
 * Minimal cron expression matcher.
 *
 * Supports the standard five fields
 * (minute hour day-of-month month day-of-week) with `*`, single values,
 * ranges (`a-b`), lists (`a,b,c`), steps (`a-b/n`, `a/n`, and a step on `*`),
 * three-letter month and weekday names, and the common `@hourly`-style macros.
 *
 * Expressions are evaluated in the server's local timezone, matching the
 * behaviour of system cron.
 *
 * @category saltcorn-data
 * @module models/internal/cron
 * @subcategory models
 */

const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * One parsed cron field. `any` is true only when the field was literally `*`,
 * which matters for the day-of-month/day-of-week rule in cronMatches.
 */
type CronField = { any: boolean; values: Set<number> };

export type CronSpec = {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
};

const resolveName = (s: string, names?: string[]): number => {
  if (names) {
    const ix = names.indexOf(s);
    if (ix >= 0) return ix + (names === MONTH_NAMES ? 1 : 0);
  }
  return /^\d+$/.test(s) ? +s : NaN;
};

const parseField = (
  spec: string,
  min: number,
  max: number,
  names?: string[]
): CronField | null => {
  const field = spec.trim();
  if (!field) return null;
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [range, stepStr, ...rest] = part.split("/");
    if (rest.length) return null;
    let step = 1;
    if (typeof stepStr !== "undefined") {
      if (!/^\d+$/.test(stepStr)) return null;
      step = +stepStr;
      if (step < 1) return null;
    }
    let lo: number;
    let hi: number;
    if (range === "*") {
      lo = min;
      hi = max;
    } else if (range.includes("-")) {
      const [loStr, hiStr, ...extra] = range.split("-");
      if (extra.length) return null;
      lo = resolveName(loStr, names);
      hi = resolveName(hiStr, names);
    } else {
      lo = resolveName(range, names);
      // a bare value with a step means "from here to the end of the range"
      hi = typeof stepStr === "undefined" ? lo : max;
    }
    if (Number.isNaN(lo) || Number.isNaN(hi)) return null;
    if (lo < min || hi > max || lo > hi) return null;
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return { any: field === "*", values };
};

/**
 * Parse a cron expression. Returns null if it is not valid.
 */
export const parseCron = (expr: string): CronSpec | null => {
  if (!expr || typeof expr !== "string") return null;
  let s = expr.trim().toLowerCase();
  if (MACROS[s]) s = MACROS[s];
  const parts = s.split(/\s+/);
  if (parts.length !== 5) return null;
  const minute = parseField(parts[0], 0, 59);
  const hour = parseField(parts[1], 0, 23);
  const dayOfMonth = parseField(parts[2], 1, 31);
  const month = parseField(parts[3], 1, 12, MONTH_NAMES);
  const dayOfWeek = parseField(parts[4], 0, 7, DAY_NAMES);
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return null;
  // both 0 and 7 mean Sunday
  if (dayOfWeek.values.has(7)) {
    dayOfWeek.values.delete(7);
    dayOfWeek.values.add(0);
  }
  return { minute, hour, dayOfMonth, month, dayOfWeek };
};

/**
 * Is this a valid cron expression?
 */
export const isValidCron = (expr: string): boolean => !!parseCron(expr);

/**
 * Does the expression fire at the minute containing this date?
 */
export const cronMatches = (spec: CronSpec, date: Date): boolean => {
  if (!spec.minute.values.has(date.getMinutes())) return false;
  if (!spec.hour.values.has(date.getHours())) return false;
  if (!spec.month.values.has(date.getMonth() + 1)) return false;
  const domMatch = spec.dayOfMonth.values.has(date.getDate());
  const dowMatch = spec.dayOfWeek.values.has(date.getDay());
  // as in Vixie cron: when both day fields are restricted, either may match
  if (spec.dayOfMonth.any) return dowMatch;
  if (spec.dayOfWeek.any) return domMatch;
  return domMatch || dowMatch;
};

/**
 * Does the expression fire at any point in [from, from + windowSeconds)?
 *
 * The minute containing `from` is only considered if `from` sits exactly on
 * the minute boundary: an occurrence earlier in that minute belongs to the
 * previous window, so counting it here would fire it twice.
 */
export const cronDueInWindow = (
  expr: string,
  from: Date,
  windowSeconds: number
): boolean => {
  const spec = parseCron(expr);
  if (!spec) return false;
  const end = from.getTime() + windowSeconds * 1000;
  const at = new Date(from.getTime());
  at.setSeconds(0, 0);
  if (at.getTime() < from.getTime()) at.setMinutes(at.getMinutes() + 1);
  // bounded so that an implausible window cannot spin
  for (let i = 0; i < 1440 && at.getTime() < end; i++) {
    if (cronMatches(spec, at)) return true;
    at.setMinutes(at.getMinutes() + 1);
  }
  return false;
};
