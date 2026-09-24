/**
 * @category server
 * @module auth/restore_jobs
 * @subcategory auth
 */
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import os from "os";
import { join } from "path";
import db from "@saltcorn/data/db";
import { getState } from "@saltcorn/data/db/state";
import Plugin from "@saltcorn/data/models/plugin";
import Trigger from "@saltcorn/data/models/trigger";
import _am_backup from "@saltcorn/admin-models/models/backup";
const { restore } = _am_backup;

type RestoreProgress =
  | { status: "progress"; message: string; ts?: number }
  | { status: "done" }
  | { status: "error"; message: string }
  | { status: "password_required" };

// jobId ends up in a file path, and callers may pass in raw user input,
// so validate the shape to block path traversal (e.g. "../../etc/foo")
const JOB_ID_RE = /^[0-9a-f-]{36}$/i;

// a running job re-sends its last message this often, so the client
// can tell a slow step from a job that died with its worker
const HEARTBEAT_MS = 20 * 1000;

// status files older than this are removed when a new job starts
const STATUS_FILE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Fallback for clients whose websocket isn't working. Kept in the file
// store, not the OS tmp dir, so every node of a multi-node setup sees it.
const statusDir = () =>
  join(db.connectObj.file_store || os.tmpdir(), ".saltcorn-tmp", "restore-jobs");

const statusFile = (jobId: string) =>
  join(statusDir(), `sc-restore-${jobId}.json`);

const writeStatusFile = (jobId: string, data: RestoreProgress) => {
  try {
    fs.mkdirSync(statusDir(), { recursive: true });
    fs.writeFileSync(statusFile(jobId), JSON.stringify(data));
  } catch (e) {
    console.error("restore job: unable to write status file", e);
  }
};

const removeOldStatusFiles = () => {
  try {
    const now = Date.now();
    for (const fnm of fs.readdirSync(statusDir())) {
      const fp = join(statusDir(), fnm);
      if (now - fs.statSync(fp).mtimeMs > STATUS_FILE_MAX_AGE_MS)
        fs.unlinkSync(fp);
    }
  } catch {
    // no dir yet, or a file went away meanwhile
  }
};

const getRestoreJobStatus = (jobId: string): RestoreProgress | null => {
  if (!JOB_ID_RE.test(jobId)) return null;
  try {
    return JSON.parse(fs.readFileSync(statusFile(jobId)).toString());
  } catch {
    return null;
  }
};

type JobRunner = (onLog: (msg: string) => void) => Promise<void>;

/**
 * Runs a job in the background and returns a job id right away.
 * Progress updates are pushed live to the browser over socket.io,
 * and also written to a tmp file so a client can poll for them if its
 * websocket isn't working.
 * @param run does the work, calls onLog for progress, throws on failure
 * @param jobId reuse an existing job id, otherwise a fresh one is minted
 * @returns job id
 */
const startJob = (run: JobRunner, jobId: string = uuidv4()): string => {
  const ten = db.getTenantSchema();
  const emit = (data: RestoreProgress) => {
    getState()!.emitRestoreProgress(ten, jobId, data);
    writeStatusFile(jobId, data);
  };
  let lastMsg = "";
  const onLog = (msg: string) => {
    lastMsg = msg;
    emit({ status: "progress", message: msg, ts: Date.now() });
  };

  removeOldStatusFiles();
  // written right away, so an early poll doesn't see an unknown job
  onLog("");
  const heartbeat = setInterval(() => onLog(lastMsg), HEARTBEAT_MS);
  heartbeat.unref?.();

  run(onLog)
    .then(() => {
      clearInterval(heartbeat);
      emit({ status: "done" });
    })
    .catch((error: any) => {
      clearInterval(heartbeat);
      console.error(error);
      if (error?.requiresPassword) emit({ status: "password_required" });
      else
        emit({
          status: "error",
          message: error?.message || String(error),
        });
    });

  return jobId;
};

/**
 * Starts a backup restore in the background, see startJob.
 * @param fnm path to the (already uploaded) backup zip
 * @param restoreFirstUser
 * @param password
 * @param jobId reuse an existing job id (e.g. on a password retry),
 *   otherwise a fresh one is minted
 * @returns job id
 */
const startRestoreJob = (
  fnm: string,
  restoreFirstUser: boolean,
  password?: string,
  jobId: string = uuidv4()
): string =>
  startJob(async (onLog) => {
    let err;
    try {
      err = await restore(
        fnm,
        (p: Plugin) => Plugin.loadAndSaveNewPlugin(p),
        restoreFirstUser,
        password,
        onLog
      );
    } catch (error: any) {
      // keep fnm on disk, needed for the password retry
      if (!error?.requiresPassword) fs.unlink(fnm, () => {});
      throw error;
    }
    fs.unlink(fnm, () => {});
    if (err) throw new Error(err);
    await getState()!.refresh_plugins();
    Trigger.emitEvent("Startup");
  }, jobId);

export { startJob, startRestoreJob, getRestoreJobStatus, JOB_ID_RE };
