import getApp from "../app.js";
import { request as request } from "../auth/testhelp.js";
import { toRedirect, resetToFixtures } from "../auth/testhelp.js";
import db from "@saltcorn/data/db";
import { sleep } from "@saltcorn/data/utils";

afterAll(async () => {
  await sleep(100);
  db.close();
});
beforeAll(async () => {
  await resetToFixtures();
});

// The restore-a-backup flow is reachable without logging in, because it exists
// to bootstrap an empty instance from the create-first-user page. It must
// therefore refuse to do anything once the instance has users: otherwise an
// unauthenticated request can drive a system restore on a live application.
// The fixtures have users, so every request in this file must be turned away.
const jobId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

describe("restore backup password endpoints with users present", () => {
  it("should not start a restore job on POST when users are present", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .post(`/auth/restore_backup_password?jobId=${jobId}`)
      .send("password=Sup3rSecret")
      .expect(toRedirect("/auth/login"));
  });

  it("should not offer the backup password form on GET when users are present", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get(`/auth/restore_backup_password?jobId=${jobId}`)
      .expect(toRedirect("/auth/login"));
  });
});
