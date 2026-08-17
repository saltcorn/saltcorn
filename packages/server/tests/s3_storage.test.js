/**
 * End-to-end S3 tests against a real S3-compatible server (MinIO in a
 * container). Two independent features are covered:
 *
 *   - file storage on S3 (storage_s3_* config): uploads land in the bucket,
 *     are listed, served through presigned URLs, moved and deleted;
 *   - backup to S3 (backup_s3_* config and auto_backup_destination): the
 *     backup zip is uploaded under the configured prefix, and the retention
 *     policy expires old ones.
 *
 * They are configured separately in Saltcorn - a site can back up to S3 while
 * keeping files on local disk - so the two describes set up their own state.
 *
 * Skipped unless SALTCORN_TEST_S3_ENDPOINT is set - see tests/s3help.js for
 * how to run it locally.
 */
import { request } from "../auth/testhelp.js";
import getApp from "../app.js";
import File from "@saltcorn/data/models/file";
import Table from "@saltcorn/data/models/table";
import db from "@saltcorn/data/db";
import { getState } from "@saltcorn/data/db/state";
import reset from "@saltcorn/data/db/reset_schema";
import backup from "@saltcorn/admin-models/models/backup";
import { readdir, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createRequire } from "module";
import {
  getAdminLoginCookie,
  toSucceed,
  resetToFixtures,
} from "../auth/testhelp.js";
import {
  s3TestsEnabled,
  endpointUrl,
  filesBucket,
  backupBucket,
  tenantKey,
  ensureBuckets,
  listKeys,
  emptyBucket,
  headKey,
  getKey,
  putKey,
  configureS3Storage,
  configureS3Backup,
} from "./s3help.js";

const require = createRequire(import.meta.url);
const { auto_backup_now, restore } = backup;

const describeS3 = s3TestsEnabled() ? describe : describe.skip;

afterAll(async () => {
  await db.close();
});

beforeAll(async () => {
  if (!s3TestsEnabled()) return;
  await resetToFixtures();
  await ensureBuckets();
});

const mkFile = async (name, contents, minRole = 100, folder = "/") =>
  await File.from_contents(name, "text/plain", contents, 1, minRole, folder);

describeS3("S3 file storage", () => {
  beforeEach(async () => {
    await emptyBucket(filesBucket());
    await configureS3Storage(true);
  });

  afterAll(async () => {
    // leave storage on local disk for anything that runs after this block
    await configureS3Storage(false);
  });

  it("writes an uploaded file to the bucket", async () => {
    const file = await mkFile("hello.txt", "hello s3");
    expect(file.s3_store).toBe(true);

    const head = await headKey(filesBucket(), tenantKey("hello.txt"));
    expect(head).toBeTruthy();
    expect(head.ContentLength).toBe(8);
    // s3_helpers stores Saltcorn's file attributes as sc-* object metadata
    expect(head.Metadata["sc-filename"]).toBe("hello.txt");
    expect(head.Metadata["sc-min-role"]).toBe("100");
  });

  it("reads the contents back out of the bucket", async () => {
    await mkFile("roundtrip.txt", "the quick brown fox");
    const file = await File.findOne("roundtrip.txt");
    expect(file).toBeTruthy();
    expect(await file.get_contents("utf8")).toBe("the quick brown fox");
    expect(file.mimetype).toBe("text/plain");
    expect(file.min_role_read).toBe(100);
  });

  it("lists files from the bucket", async () => {
    await mkFile("one.txt", "1");
    await mkFile("two.txt", "2");
    const files = await File.find({});
    const names = files.map((f) => f.filename);
    expect(names).toContain("one.txt");
    expect(names).toContain("two.txt");
  });

  it("creates folders and lists their contents", async () => {
    await File.new_folder("reports");
    await mkFile("q1.txt", "first quarter", 100, "reports");

    const keys = await listKeys(filesBucket(), tenantKey("reports/"));
    expect(keys).toContain(tenantKey("reports/.keep"));
    expect(keys).toContain(tenantKey("reports/q1.txt"));

    const inFolder = await File.find({ folder: "reports" });
    expect(inFolder.map((f) => f.filename)).toContain("q1.txt");

    const dirs = await File.allDirectories();
    expect(dirs.map((d) => d.path_to_serve)).toContain("reports");
  });

  it("moves the object when a file is renamed", async () => {
    await mkFile("before.txt", "same contents");
    const file = await File.findOne("before.txt");
    await file.rename("after.txt");

    expect(await headKey(filesBucket(), tenantKey("after.txt"))).toBeTruthy();
    expect(await headKey(filesBucket(), tenantKey("before.txt"))).toBeNull();
    const moved = await File.findOne("after.txt");
    expect(await moved.get_contents("utf8")).toBe("same contents");
  });

  it("removes the object when a file is deleted", async () => {
    await mkFile("doomed.txt", "not for long");
    const file = await File.findOne("doomed.txt");
    await file.delete();
    expect(await headKey(filesBucket(), tenantKey("doomed.txt"))).toBeNull();
  });

  it("uploads through the files route into the bucket", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/files/upload")
      .set("Cookie", loginCookie)
      .set("X-Requested-With", "XMLHttpRequest")
      .field("min_role_read", "100")
      .attach("file", Buffer.from("uploaded via http", "utf-8"), "posted.txt")
      .expect(toSucceed());

    const keys = await listKeys(filesBucket());
    const posted = keys.find((k) => k.endsWith("posted.txt"));
    expect(posted).toBeTruthy();
    expect((await getKey(filesBucket(), posted)).toString()).toBe(
      "uploaded via http"
    );
    expect(keys.filter((k) => k.startsWith("tmp/"))).toHaveLength(0);
  });

  it("serves a file by redirecting to a working presigned URL", async () => {
    await mkFile("served.txt", "served from s3");
    const app = await getApp({ disableCsrf: true });
    const res = await request(app).get("/files/serve/served.txt");
    expect(res.status).toBe(302);

    const location = res.headers.location;
    expect(location.startsWith(endpointUrl())).toBe(true);
    expect(location).toContain("X-Amz-Signature");

    const fetched = await fetch(location);
    expect(fetched.status).toBe(200);
    expect(await fetched.text()).toBe("served from s3");
  });

  it("downloads with a content-disposition attachment", async () => {
    await mkFile("attach.txt", "download me");
    const app = await getApp({ disableCsrf: true });
    const res = await request(app).get("/files/download/attach.txt");
    expect(res.status).toBe(302);

    const fetched = await fetch(res.headers.location);
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get("content-disposition")).toContain("attachment");
    expect(fetched.headers.get("content-disposition")).toContain("attach.txt");
    expect(await fetched.text()).toBe("download me");
  });

  it("does not serve a file the user may not read", async () => {
    await mkFile("secret.txt", "admin eyes only", 1);
    const app = await getApp({ disableCsrf: true });
    const res = await request(app).get("/files/serve/secret.txt");
    expect(res.status).toBe(404);

    const loginCookie = await getAdminLoginCookie();
    const asAdmin = await request(app)
      .get("/files/serve/secret.txt")
      .set("Cookie", loginCookie);
    expect(asAdmin.status).toBe(302);
  });

  it("returns direct bucket URLs when direct links are enabled", async () => {
    await mkFile("direct.txt", "direct link");
    await getState().setConfig("files_direct_s3_links", true);
    try {
      const url = File.pathToServeUrl("direct.txt");
      expect(url).toBe(
        `${endpointUrl()}/${filesBucket()}/${tenantKey("direct.txt")}`
      );
      const fetched = await fetch(url);
      expect(fetched.status).toBe(403);
    } finally {
      await getState().setConfig("files_direct_s3_links", false);
    }
  });
});

describeS3("Backup to S3", () => {
  // the backup is uploaded from memory and never written to the local disk,
  // but sweep up between tests in case that regresses
  const removeLocalBackups = async () => {
    const prefix = getState().getConfig("backup_file_prefix", "sc-backup-");
    for (const f of await readdir(process.cwd()))
      if (f.startsWith(prefix) && f.endsWith(".zip"))
        await unlink(f).catch(() => {});
  };

  beforeEach(async () => {
    await emptyBucket(backupBucket());
    // backup to S3 is independent of where files are stored
    await configureS3Storage(false);
    await configureS3Backup();
  });

  afterEach(removeLocalBackups);

  it("uploads a backup zip with the expected entries to the bucket", async () => {
    await auto_backup_now();

    const keys = await listKeys(backupBucket());
    expect(keys).toHaveLength(1);
    expect(keys[0].startsWith("sc-backup-")).toBe(true);
    expect(keys[0].endsWith(".zip")).toBe(true);

    const head = await headKey(backupBucket(), keys[0]);
    expect(head.ContentType).toBe("application/zip");

    const buffer = await getKey(backupBucket(), keys[0]);
    const AdmZip = require("adm-zip");
    const entries = new AdmZip(buffer).getEntries().map((e) => e.entryName);
    expect(entries).toContain("pack.json");
    expect(entries).toContain("backup-info.json");
    expect(entries).toContain("metadata.json");
    expect(entries.some((e) => e.startsWith("tables/"))).toBe(true);
  });

  it("writes under the configured path prefix", async () => {
    await configureS3Backup({ prefix: "nightly/tenant1" });
    await auto_backup_now();

    const keys = await listKeys(backupBucket());
    expect(keys).toHaveLength(1);
    expect(keys[0].startsWith("nightly/tenant1/sc-backup-")).toBe(true);
  });

  const RETENTION_SECONDS = 5;
  const RETENTION_DAYS = RETENTION_SECONDS / (24 * 60 * 60);
  const OLD_BACKUP_KEY = "sc-backup-Saltcorn-2020-01-01-00-00.zip";

  /**
   * Stand in for a backup taken earlier: an object with the backup file
   * prefix, aged past the retention period. Two auto backups cannot be used
   * for this - create_backup names the zip to minute resolution, so a second
   * run in the same minute overwrites the first rather than adding to it.
   *
   * The object store sets LastModified itself and there is no way to backdate
   * it, so ageing the object means waiting it out.
   */
  const putAgedBackup = async () => {
    await putKey(backupBucket(), OLD_BACKUP_KEY, "an earlier backup");
    await new Promise((resolve) =>
      setTimeout(resolve, (RETENTION_SECONDS + 1) * 1000)
    );
  };

  /** The backup zips in the bucket, ignoring anything else stored there. */
  const backupKeys = (keys) =>
    keys.filter((k) => k.split("/").pop().startsWith("sc-backup-"));

  it("expires backups older than the retention period", async () => {
    await configureS3Backup({ expireDays: RETENTION_DAYS });
    await putAgedBackup();

    await auto_backup_now();

    const keys = await listKeys(backupBucket());
    expect(keys).not.toContain(OLD_BACKUP_KEY);
    expect(backupKeys(keys)).toHaveLength(1);
  });

  it("keeps every backup when retention is disabled", async () => {
    await configureS3Backup({ expireDays: 0 });
    await putAgedBackup();

    await auto_backup_now();

    const keys = await listKeys(backupBucket());
    expect(keys).toContain(OLD_BACKUP_KEY);
    expect(backupKeys(keys)).toHaveLength(2);
  });

  it("only expires objects matching the backup file prefix", async () => {
    await configureS3Backup({ expireDays: RETENTION_DAYS });
    await putKey(backupBucket(), "unrelated/keepme.txt", "not a backup");
    await putAgedBackup();

    await auto_backup_now();

    const keys = await listKeys(backupBucket());
    expect(keys).toContain("unrelated/keepme.txt");
    expect(keys).not.toContain(OLD_BACKUP_KEY);
  });

  it("restores the application from the backup in the bucket", async () => {
    await getApp({ disableCsrf: true });

    const books = Table.findOne({ name: "books" });
    await books.insertRow({ author: "Round Trip", pages: 321 });
    const booksBefore = await books.countRows();

    await auto_backup_now();
    const keys = backupKeys(await listKeys(backupBucket()));
    expect(keys).toHaveLength(1);
    const zip = await getKey(backupBucket(), keys[0]);

    const zipPath = join(tmpdir(), `sc-s3-restore-${process.pid}.zip`);
    await writeFile(zipPath, zip);
    try {
      await reset();
      expect(Table.findOne({ name: "books" })).toBe(null);

      const err = await restore(zipPath, () => {}, true);
      expect(err).toBe(undefined);

      const restored = Table.findOne({ name: "books" });
      expect(restored).toBeTruthy();
      expect(await restored.countRows()).toBe(booksBefore);
      const row = await restored.getRow({ author: "Round Trip" });
      expect(row).toBeTruthy();
      expect(row.pages).toBe(321);
    } finally {
      await unlink(zipPath).catch(() => {});
    }
  });

  afterAll(async () => {
    await resetToFixtures();
  });
});
