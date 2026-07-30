import {
  selectBackupsToDelete,
  selectBackupsToDeleteGrouped,
  BackupEntry,
  RetentionPolicy,
} from "../models/backup-retention.js";
import { describe, it, expect } from "@saltcorn/db-common/test_expect";

const mkEntry = (iso: string, key?: string): BackupEntry => ({
  key: key || `sc-backup-Site-${iso}.zip`,
  date: new Date(`${iso}T03:00:00Z`),
});

/** N consecutive daily backups ending at `end` (inclusive), newest last */
const dailySeries = (
  end: string,
  n: number,
  prefix = "Site"
): BackupEntry[] => {
  const endDate = new Date(`${end}T03:00:00Z`);
  const out: BackupEntry[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(endDate.getTime() - i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    out.push({ key: `sc-backup-${prefix}-${iso}.zip`, date: d });
  }
  return out;
};

const policy = (p: Partial<RetentionPolicy>): RetentionPolicy => ({
  keep_daily: 0,
  keep_weekly: 0,
  keep_monthly: 0,
  keep_yearly: 0,
  keep_min: 0,
  ...p,
});

describe("selectBackupsToDelete", () => {
  it("returns nothing for an empty list", () => {
    expect(selectBackupsToDelete([], policy({ keep_daily: 7 }))).toEqual([]);
  });

  it("keeps the last N daily backups", () => {
    const entries = dailySeries("2026-07-26", 30);
    const del = selectBackupsToDelete(entries, policy({ keep_daily: 7 }));
    expect(del).toHaveLength(23);
    const deletedKeys = new Set(del.map((e) => e.key));
    // the 7 newest must survive
    for (const e of entries.slice(-7))
      expect(deletedKeys.has(e.key)).toBe(false);
  });

  it("keeps one backup per ISO week for keep_weekly", () => {
    const entries = dailySeries("2026-07-26", 28); // 4+ ISO weeks
    const del = selectBackupsToDelete(entries, policy({ keep_weekly: 4 }));
    const kept = entries.filter((e) => !del.includes(e));
    expect(kept).toHaveLength(4);
    // one kept backup per week, all on distinct days
    const days = new Set(kept.map((e) => e.date.toISOString().slice(0, 10)));
    expect(days.size).toBe(4);
  });

  it("a single backup can satisfy multiple tiers", () => {
    const entries = [mkEntry("2026-07-26")];
    const del = selectBackupsToDelete(
      entries,
      policy({
        keep_daily: 7,
        keep_weekly: 4,
        keep_monthly: 12,
        keep_yearly: 3,
      })
    );
    expect(del).toEqual([]);
  });

  it("combined GFS policy over a year of daily backups", () => {
    const entries = dailySeries("2026-07-26", 365);
    const del = selectBackupsToDelete(
      entries,
      policy({
        keep_daily: 7,
        keep_weekly: 4,
        keep_monthly: 12,
        keep_yearly: 3,
      })
    );
    const kept = entries.length - del.length;
    // 7 daily + 4 weekly + 12 monthly + yearly, minus overlaps
    expect(kept).toBeGreaterThanOrEqual(12);
    expect(kept).toBeLessThanOrEqual(26);
  });

  it("keep_min prevents deleting the last backups even when all are old", () => {
    // 5 backups, all several years old, policy window long passed
    const entries = dailySeries("2020-01-05", 5);
    const del = selectBackupsToDelete(
      entries,
      policy({ keep_daily: 7, keep_min: 3 })
    );
    // keep_daily keeps 5 (each its own day-bucket within capacity 7)
    expect(del).toEqual([]);
    // stricter: only 1 daily slot, keep_min=3 → exactly 2 deleted
    const del2 = selectBackupsToDelete(
      entries,
      policy({ keep_daily: 1, keep_min: 3 })
    );
    expect(del2).toHaveLength(2);
  });

  it("never deletes everything when keep_min > 0", () => {
    const entries = dailySeries("2019-06-01", 10);
    const del = selectBackupsToDelete(entries, policy({ keep_min: 1 }));
    expect(del).toHaveLength(9);
    // the newest is the one retained
    expect(del.map((e) => e.key)).not.toContain(entries[9].key);
  });

  it("keeps the newest backup of each of the last N months", () => {
    // one backup every 5 days for a year
    const entries: BackupEntry[] = [];
    const end = new Date("2026-07-26T03:00:00Z").getTime();
    for (let i = 72; i >= 0; i--) {
      const d = new Date(end - i * 5 * 86400000);
      entries.push({
        key: `sc-backup-Site-${d.toISOString().slice(0, 10)}.zip`,
        date: d,
      });
    }
    const del = selectBackupsToDelete(entries, policy({ keep_monthly: 3 }));
    const kept = entries.filter((e) => !del.includes(e));
    expect(kept).toHaveLength(3);
    const months = new Set(kept.map((e) => e.date.toISOString().slice(0, 7)));
    expect(months.size).toBe(3);
  });
});

describe("selectBackupsToDeleteGrouped", () => {
  it("applies the policy per tenant", () => {
    const root = dailySeries("2026-07-26", 10, "Root");
    const t1 = dailySeries("2026-07-26", 10, "tenant1");
    const del = selectBackupsToDeleteGrouped(
      [...root, ...t1],
      policy({ keep_daily: 7 })
    );
    // 3 deleted per tenant — tenants do not steal each other's slots
    expect(del).toHaveLength(6);
    expect(del.filter((e) => e.key.includes("Root"))).toHaveLength(3);
    expect(del.filter((e) => e.key.includes("tenant1"))).toHaveLength(3);
  });

  it("groups by basename, ignoring the key path prefix", () => {
    const withPrefix = dailySeries("2026-07-26", 10).map((e) => ({
      ...e,
      key: `backups/prod/${e.key}`,
    }));
    const del = selectBackupsToDeleteGrouped(
      withPrefix,
      policy({ keep_daily: 7 })
    );
    expect(del).toHaveLength(3);
  });

  it("groups non-matching filenames by their own basename", () => {
    const odd: BackupEntry = {
      key: "manual-export.zip",
      date: new Date("2020-01-01T00:00:00Z"),
    };
    const del = selectBackupsToDeleteGrouped(
      [odd, ...dailySeries("2026-07-26", 3)],
      policy({ keep_daily: 1, keep_min: 1 })
    );
    // the odd file forms its own group and is kept by its own keep_min
    expect(del.map((e) => e.key)).not.toContain("manual-export.zip");
  });
});
