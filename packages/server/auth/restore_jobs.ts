/**
 * @category server
 * @module auth/restore_jobs
 * @subcategory auth
 */
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import db from "@saltcorn/data/db";
import { getState } from "@saltcorn/data/db/state";
import Plugin from "@saltcorn/data/models/plugin";
import Trigger from "@saltcorn/data/models/trigger";
import _am_backup from "@saltcorn/admin-models/models/backup";
const { restore } = _am_backup;

/**
 * Starts a backup restore in the background and returns a job id right
 * away. Progress updates are pushed live to the browser; nothing is saved,
 * so a client that isn't listening at the time just misses them.
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
  const onLog = (msg: string) =>
    getState()!.emitRestoreProgress(ten, jobId, {
      status: "progress",
      message: msg,
    });

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
        getState()!.emitRestoreProgress(ten, jobId, {
          status: "error",
          message: err,
        });
        return;
      }
      await getState()!.refresh_plugins();
      Trigger.emitEvent("Startup");
      getState()!.emitRestoreProgress(ten, jobId, { status: "done" });
    })
    .catch((error: any) => {
      console.error(error);
      if (error?.requiresPassword) {
        // keep fnm on disk, needed for the password retry
        getState()!.emitRestoreProgress(ten, jobId, {
          status: "password_required",
        });
        return;
      }
      fs.unlink(fnm, () => {});
      getState()!.emitRestoreProgress(ten, jobId, {
        status: "error",
        message: error?.message || String(error),
      });
    });

  return jobId;
};

export { startRestoreJob };
