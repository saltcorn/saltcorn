import fs from "fs";
import os from "os";
import path from "path";
import { request as request } from "../auth/testhelp.js";
import getApp from "../app.js";
import {
  getAdminLoginCookie,
  resetToFixtures,
  toSucceed,
} from "../auth/testhelp.js";
import db from "@saltcorn/data/db";
import { getState } from "@saltcorn/data/db/state";
import { sleep } from "@saltcorn/data/tests/mocks";

// Upgrade/install run npm and docker and then stop the server.
// Fake npm and docker scripts on PATH log their arguments instead,
// and process.exit is stubbed so the test process survives.

const isWin = process.platform === "win32";
let binDir, logFile, oldPath, oldExit, oldProcessSend;

const writeScript = (name, body) => {
  const file = path.join(binDir, name);
  fs.writeFileSync(
    file,
    `#!/bin/sh\necho "${name} $*" >> "$FAKE_LOG"\n${body}\n`
  );
  fs.chmodSync(file, 0o755);
};

// fake npm: "npm view" answers with the given version (or fails without one)
const fakeNpm = (latest) =>
  writeScript(
    "npm",
    latest
      ? `if [ "$1" = "view" ]; then echo "${latest}"; fi; exit 0`
      : `if [ "$1" = "view" ]; then echo "npm error" >&2; exit 1; fi; exit 0`
  );

const calls = () =>
  fs.existsSync(logFile)
    ? fs.readFileSync(logFile, "utf8").trim().split("\n")
    : [];

const post = async (url, body) => {
  const app = await getApp({ disableCsrf: true });
  const loginCookie = await getAdminLoginCookie();
  const req = request(app).post(url).set("Cookie", loginCookie);
  if (body) req.send(body);
  await req.expect(toSucceed());
  // let the delayed restart run against the stubs
  await sleep(400);
};

beforeAll(async () => {
  await resetToFixtures();
  if (isWin) return;
  binDir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-fake-bin-"));
  logFile = path.join(binDir, "calls.log");
  writeScript("docker", "exit 0");
  oldPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${oldPath}`;
  process.env.FAKE_LOG = logFile;
  oldExit = process.exit;
  process.exit = () => {};
  oldProcessSend = getState().processSend;
  getState().processSend = () => {};
});

beforeEach(() => {
  if (!isWin) fs.rmSync(logFile, { force: true });
});

afterAll(async () => {
  if (!isWin) {
    process.exit = oldExit;
    getState().processSend = oldProcessSend;
    process.env.PATH = oldPath;
    delete process.env.FAKE_LOG;
    fs.rmSync(binDir, { recursive: true, force: true });
  }
  await sleep(200);
  db.close();
});

describe("admin upgrade", () => {
  it("installs and pulls the version that latest resolves to", async () => {
    if (isWin) return;
    fakeNpm("1.6.4");
    await post("/admin/upgrade");
    expect(calls()).toEqual([
      "npm view @saltcorn/cli@latest version",
      "npm install -g @saltcorn/cli@1.6.4 --omit=dev",
      "docker pull saltcorn/capacitor-builder:1.6.4",
      "docker image prune -f",
    ]);
  });

  it("falls back to latest when npm view fails", async () => {
    if (isWin) return;
    fakeNpm(null);
    await post("/admin/upgrade");
    expect(calls()).toEqual([
      "npm view @saltcorn/cli@latest version",
      "npm install -g @saltcorn/cli@latest --omit=dev",
      "docker pull saltcorn/capacitor-builder:latest",
      "docker image prune -f",
    ]);
  });
});

describe("admin install", () => {
  it("installs the requested version without resolving a tag", async () => {
    if (isWin) return;
    fakeNpm("1.6.4");
    await post("/admin/install", "version=1.6.3");
    const log = calls();
    expect(log).not.toContain("npm view @saltcorn/cli@latest version");
    expect(log[0]).toBe("npm install -g @saltcorn/cli@1.6.3 --omit=dev");
    // a pull only happens when a builder image is present, then with the same tag
    for (const line of log.filter((l) => l.startsWith("docker pull")))
      expect(line).toBe("docker pull saltcorn/capacitor-builder:1.6.3");
  });
});
