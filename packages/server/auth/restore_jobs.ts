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
  | { status: "progress"; message: string }
  | { status: "done" }
  | { status: "error"; message: string }
  | { status: "password_required" };

// jobId ends up in a file path, and callers may pass in raw user input,
// so validate the shape to block path traversal (e.g. "../../etc/foo")
const JOB_ID_RE = /^[0-9a-f-]{36}$/i;

// Fallback for clients whose websocket isn't working. Multi-node setups
// already need a shared drive, so a tmp file works fine here too.
const statusFile = (jobId: string) =>
  join(os.tmpdir(), `sc-restore-${jobId}.json`);

const writeStatusFile = (jobId: string, data: RestoreProgress) => {
  try {
    fs.writeFileSync(statusFile(jobId), JSON.stringify(data));
  } catch (e) {
    console.error("restore job: unable to write status file", e);
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

/**
 * Starts a backup restore in the background and returns a job id right
 * away. Progress updates are pushed live to the browser over socket.io,
 * and also written to a tmp file so a client can poll for them if its
 * websocket isn't working.
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
): string => {
  const ten = db.getTenantSchema();
  const emit = (data: RestoreProgress) => {
    getState()!.emitRestoreProgress(ten, jobId, data);
    writeStatusFile(jobId, data);
  };
  const onLog = (msg: string) => emit({ status: "progress", message: msg });

  restore(
    fnm,
    (p: Plugin) => Plugin.loadAndSaveNewPlugin(p),
    restoreFirstUser,
    password,
    onLog
  )
    .then(async (err) => {
      fs.unlink(fnm, () => {});
      if (err) {
        console.error(err);
        emit({ status: "error", message: err });
        return;
      }
      await getState()!.refresh_plugins();
      Trigger.emitEvent("Startup");
      emit({ status: "done" });
    })
    .catch((error: any) => {
      console.error(error);
      if (error?.requiresPassword) {
        // keep fnm on disk, needed for the password retry
        emit({ status: "password_required" });
        return;
      }
      fs.unlink(fnm, () => {});
      emit({
        status: "error",
        message: error?.message || String(error),
      });
    });

  return jobId;
};

export { startRestoreJob, getRestoreJobStatus, JOB_ID_RE };
