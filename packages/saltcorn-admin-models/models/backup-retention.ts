/**
 * Tiered (GFS) backup retention classifier.
 *
 * Given a list of backup entries and a keep-policy, returns the entries
 * that should be DELETED. Mirrors the semantics of `restic forget`:
 * for each tier (daily / weekly / monthly / yearly), the newest backup
 * in each of the most recent N buckets is kept. An entry survives if any
 * tier keeps it. `keep_min` is a safety net that guarantees a minimum
 * number of retained backups regardless of age.
 *
 * Pure and I/O-free: no Saltcorn imports, so it is unit-testable without
 * a database or a backup destination.
 * @category saltcorn-admin-models
 * @module models/backup-retention
 */

export type BackupEntry = {
  /** Object key (S3) or filename (local / SFTP) */
  key: string;
  /** Backup timestamp (LastModified / file mtime) */
  date: Date;
};

export type RetentionPolicy = {
  keep_daily: number;
  keep_weekly: number;
  keep_monthly: number;
  keep_yearly: number;
  keep_min: number;
};

/** ISO-8601 week number (1..53), week starts Monday. */
const isoWeek = (d: Date): string => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7; // Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum); // nearest Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

const dayBucket = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const monthBucket = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const yearBucket = (d: Date): string => `${d.getFullYear()}`;

type Tier = {
  remaining: number;
  bucketOf: (d: Date) => string;
  seen: Set<string>;
};

/**
 * Returns the subset of `entries` that should be deleted under `policy`.
 * Entries not returned are retained.
 * @param entries backup entries (any order)
 * @param policy how many backups to keep per tier
 * @returns the deletion candidates
 */
export const selectBackupsToDelete = (
  entries: BackupEntry[],
  policy: RetentionPolicy
): BackupEntry[] => {
  if (entries.length === 0) return [];

  // newest first
  const sorted = [...entries].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  const tiers: Tier[] = [
    { remaining: policy.keep_daily, bucketOf: dayBucket, seen: new Set() },
    { remaining: policy.keep_weekly, bucketOf: isoWeek, seen: new Set() },
    { remaining: policy.keep_monthly, bucketOf: monthBucket, seen: new Set() },
    { remaining: policy.keep_yearly, bucketOf: yearBucket, seen: new Set() },
  ];

  const kept = new Set<BackupEntry>();

  for (const entry of sorted) {
    for (const tier of tiers) {
      if (tier.remaining <= 0) continue;
      const bucket = tier.bucketOf(entry.date);
      if (tier.seen.has(bucket)) continue;
      // newest entry of a fresh bucket in a tier with capacity → keep
      tier.seen.add(bucket);
      tier.remaining--;
      kept.add(entry);
      // NOTE: no `break` — a single backup may satisfy several tiers
      // at once (e.g. newest daily is also newest weekly/monthly).
    }
  }

  // Safety net: never fall below keep_min retained backups
  if (policy.keep_min > 0 && kept.size < policy.keep_min) {
    for (const entry of sorted) {
      if (kept.size >= policy.keep_min) break;
      kept.add(entry);
    }
  }

  return sorted.filter((e) => !kept.has(e));
};

/**
 * Group entries by tenant so each tenant gets its own GFS ladder.
 *
 * Backup filenames follow `${prefix}${site_or_tenant}-${date}.zip`
 * (see create_backup()). The grouping key is the basename with the
 * trailing `-<date>.zip` stripped; entries that do not match the
 * pattern fall into their full basename as a conservative default
 * (they are then subject to keep_min within their own group).
 * @param entries backup entries
 * @returns entries grouped by tenant key
 */
export const groupByTenant = (
  entries: BackupEntry[]
): Map<string, BackupEntry[]> => {
  const groups = new Map<string, BackupEntry[]>();
  for (const entry of entries) {
    const base = entry.key.split("/").pop() || entry.key;
    const m = base.match(/^(.*)-\d{4}-\d{1,2}-\d{1,2}.*\.zip$/);
    const groupKey = m ? m[1] : base;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push(entry);
  }
  return groups;
};

/**
 * Convenience wrapper: apply the policy per tenant group and return
 * the union of deletion candidates.
 * @param entries backup entries across all tenants
 * @param policy how many backups to keep per tier
 * @returns the deletion candidates
 */
export const selectBackupsToDeleteGrouped = (
  entries: BackupEntry[],
  policy: RetentionPolicy
): BackupEntry[] => {
  const out: BackupEntry[] = [];
  for (const [, group] of groupByTenant(entries))
    out.push(...selectBackupsToDelete(group, policy));
  return out;
};
