const request = require("supertest");
const getApp = require("../app");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  toRedirect,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toSucceed,
  toNotInclude,
  resetToFixtures,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const fs = require("fs").promises;
const File = require("@saltcorn/data/models/file");

beforeAll(async () => {
  await resetToFixtures();
  const mv = async (fnm) => {
    await fs.writeFile(fnm, "nevergonnagiveyouup");
  };
  await File.from_req_files(
    { mimetype: "image/png", name: "rick.png", mv, size: 245752 },
    1,
    4
  );
});
afterAll(db.close);

describe("files admin", () => {
  itShouldRedirectUnauthToLogin("/files");
  it("show files list", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/files")
      .set("Cookie", loginCookie)
      .expect(toInclude("Size (KiB)"));
  });
  it("download file", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/files/download/2")
      .set("Cookie", loginCookie)
      .expect(toSucceed());
  });

  it("serve file", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get("/files/serve/2")
      .set("Cookie", loginCookie)
      .expect(toSucceed());
  });
  it("not serve file to public", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/files/serve/2").expect(toRedirect("/"));
  });
  it("set file min role", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/files/setrole/2")
      .set("Cookie", loginCookie)
      .send("role=10")
      .expect(toRedirect("/files"));
  });
  it("serve file to public after role change", async () => {
    const app = await getApp({ disableCsrf: true });
    await request(app).get("/files/serve/2").expect(toSucceed());
  });
});
