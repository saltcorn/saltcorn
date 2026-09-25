import getApp from "../app.js";
import {
  request,
  getAdminLoginCookie,
  getStaffLoginCookie,
  resetToFixtures,
  toInclude,
  toRedirect,
} from "../auth/testhelp.js";
import db from "@saltcorn/data/db";
import { sleep } from "@saltcorn/data/tests/mocks";
import View from "@saltcorn/data/models/view";
import Library from "@saltcorn/data/models/library";
import _am_pack from "@saltcorn/admin-models/models/pack";
import { startJob, getRestoreJobStatus } from "../auth/restore_jobs.js";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { join } from "path";
const { view_pack } = _am_pack;

afterAll(async () => {
  await sleep(200);
  db.close();
});
beforeAll(async () => {
  await resetToFixtures();
});

// waits until the job is done or failed, using the polling endpoint
const waitForJob = async (app, jobId) => {
  for (let i = 0; i < 100; i++) {
    const res = await request(app).get(`/auth/restore_status/${jobId}`);
    if (res.body && ["done", "error"].includes(res.body.status))
      return res.body;
    await sleep(100);
  }
  throw new Error(`restore job ${jobId} did not finish`);
};

// waits for the status file directly, for jobs started without the app
const waitForJobFile = async (jobId) => {
  for (let i = 0; i < 100; i++) {
    const status = await getRestoreJobStatus(jobId);
    if (status && ["done", "error", "password_required"].includes(status.status))
      return status;
    await sleep(50);
  }
  throw new Error(`job ${jobId} did not finish`);
};

const emptyPack = () => ({
  tables: [],
  views: [],
  plugins: [],
  pages: [],
  page_groups: [],
  roles: [],
  library: [],
  triggers: [],
  tags: [],
});

// catches what console.error prints while fn runs, so failing jobs
// don't clutter the test output
const captureErrors = async (fn) => {
  const orig = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    await fn();
  } finally {
    console.error = orig;
  }
  return logged;
};

const postSnapshot = (app, loginCookie, content, fields = {}) => {
  let req = request(app)
    .post("/admin/snapshot-restore-full")
    .set("Cookie", loginCookie)
    .set("X-Requested-With", "XMLHttpRequest");
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  if (content !== undefined)
    req = req.attach("file", Buffer.from(content, "utf-8"), "snapshot.json");
  return req;
};

describe("startJob", () => {
  it("reports progress and done", async () => {
    const jobId = startJob(async (onLog) => {
      onLog("step one");
      await sleep(10);
    });
    expect(await waitForJobFile(jobId)).toEqual({ status: "done" });
  });
  it("reports an error when the job throws", async () => {
    const logged = await captureErrors(async () => {
      const jobId = startJob(async () => {
        throw new Error("it broke");
      });
      expect(await waitForJobFile(jobId)).toEqual({
        status: "error",
        message: "it broke",
      });
    });
    expect(logged[0][0].message).toBe("it broke");
  });
  it("reports password_required when the job needs a password", async () => {
    const logged = await captureErrors(async () => {
      const jobId = startJob(async () => {
        const e = new Error("password");
        e.requiresPassword = true;
        throw e;
      });
      expect(await waitForJobFile(jobId)).toEqual({
        status: "password_required",
      });
    });
    expect(logged[0][0].requiresPassword).toBe(true);
  });
  it("reuses a given job id", async () => {
    const givenId = uuidv4();
    const jobId = startJob(async () => {}, givenId);
    expect(jobId).toBe(givenId);
    expect(await waitForJobFile(jobId)).toEqual({ status: "done" });
  });
});

describe("restore job status files", () => {
  const statusDir = () =>
    join(db.connectObj.file_store, ".saltcorn-tmp", "restore-jobs");

  it("writes a progress status right away, in the file store", async () => {
    let finishJob;
    const jobId = startJob(
      () => new Promise((resolve) => (finishJob = resolve))
    );
    // the first write is async, give it a moment
    let status = null;
    for (let i = 0; i < 50 && !status; i++) {
      status = await getRestoreJobStatus(jobId);
      if (!status) await sleep(20);
    }
    expect(status.status).toBe("progress");
    expect(fs.existsSync(join(statusDir(), `sc-restore-${jobId}.json`))).toBe(
      true
    );
    finishJob();
    expect(await waitForJobFile(jobId)).toEqual({ status: "done" });
  });

  it("removes old status files when a new job starts", async () => {
    fs.mkdirSync(statusDir(), { recursive: true });
    const oldFile = join(statusDir(), `sc-restore-${uuidv4()}.json`);
    const newFile = join(statusDir(), `sc-restore-${uuidv4()}.json`);
    fs.writeFileSync(oldFile, JSON.stringify({ status: "done" }));
    fs.writeFileSync(newFile, JSON.stringify({ status: "done" }));
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldFile, twoDaysAgo, twoDaysAgo);

    const jobId = startJob(async () => {});
    await waitForJobFile(jobId);
    // cleanup runs in the background, give it a moment
    for (let i = 0; i < 50 && fs.existsSync(oldFile); i++) await sleep(20);
    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(newFile)).toBe(true);
  });
});

describe("snapshot restore form", () => {
  it("submits via submit_snapshot_restore", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/admin/snapshot-restore-full")
      .set("Cookie", loginCookie)
      .expect(toInclude("submit_snapshot_restore(this, event)"));
  });
});

describe("snapshot restore POST", () => {
  it("is refused for non-admins", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .post("/admin/snapshot-restore-full")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/"));
  });

  it("returns an error without a file", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    const res = await postSnapshot(app, loginCookie);
    expect(res.body.error).toBeTruthy();
    expect(res.body.jobId).toBeUndefined();
  });

  it("returns an error for a file that is not JSON", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    const res = await postSnapshot(app, loginCookie, "this is not json");
    expect(res.body.error).toBeTruthy();
    expect(res.body.jobId).toBeUndefined();
  });

  it("restores a snapshot in the background", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    const vpack = await view_pack("authorlist");
    const pack = {
      ...emptyPack(),
      views: [{ ...vpack, name: "authorlist_from_snapshot" }],
    };
    const res = await postSnapshot(app, loginCookie, JSON.stringify(pack), {
      configuration: "on",
      modules: "on",
    });
    expect(res.body.error).toBeUndefined();
    expect(res.body.jobId).toMatch(/^[0-9a-f-]{36}$/i);

    const status = await waitForJob(app, res.body.jobId);
    expect(status).toEqual({ status: "done" });
    const view = View.findOne({ name: "authorlist_from_snapshot" });
    expect(view).toBeTruthy();
    expect(view.viewtemplate).toBe(vpack.viewtemplate);
  });

  it("reports an error and rolls back when the restore fails", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    // the library entry is written first, then the missing tables array
    // makes install_pack throw
    const { tables, ...pack } = {
      ...emptyPack(),
      library: [{ name: "snaplib_rollback", icon: "", layout: {} }],
    };
    let status;
    const logged = await captureErrors(async () => {
      const res = await postSnapshot(app, loginCookie, JSON.stringify(pack));
      expect(res.body.jobId).toBeTruthy();
      status = await waitForJob(app, res.body.jobId);
    });
    expect(status.status).toBe("error");
    expect(status.message).toBeTruthy();
    expect(logged[0][0].message).toBe(status.message);
    // sqlite's withTransaction doesn't really roll back
    if (!db.isSQLite) {
      const lib = await Library.findOne({ name: "snaplib_rollback" });
      expect(lib).toBeFalsy();
    }
  });
});
