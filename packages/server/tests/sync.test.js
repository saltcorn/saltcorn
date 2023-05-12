const request = require("supertest");
const getApp = require("../app");
const {
  getUserLoginCookie,
  getStaffLoginCookie,
  getAdminLoginCookie,
  resetToFixtures,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");

const Table = require("@saltcorn/data/models/table");

beforeAll(async () => {
  await resetToFixtures();
});
afterAll(db.close);

describe("Load offline data", () => {
  it("public request", async () => {
    const app = await getApp({ disableCsrf: true });
    const resp = await request(app).get("/sync/table_data");
    for (const [k, v] of Object.entries(resp._body)) {
      expect(v.rows.length).toBe(k === "books" ? 2 : 0);
    }
  });

  it("user request", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getUserLoginCookie();
    const resp = await request(app)
      .get("/sync/table_data")
      .set("Cookie", loginCookie);
    const data = resp._body;
    expect(data.patients.rows.length).toBe(0);
  });

  it("admin request", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    const resp = await request(app)
      .get("/sync/table_data")
      .set("Cookie", loginCookie);
    const data = resp._body;
    expect(data.patients.rows.length).toBe(2);
  });
});

describe("Synchronise with mobile offline data", () => {
  if (!db.isSQLite) {
    it("not permitted", async () => {
      const app = await getApp({ disableCsrf: true });
      const loginCookie = await getUserLoginCookie();
      const uploadResp = await request(app)
        .post("/sync/table_data")
        .set("Cookie", loginCookie)
        .send({
          data: {
            patients: [
              {
                name: "Brad Pitt",
                favbook: 2,
                parent: 1,
              },
              {
                id: 84,
                name: "Pitt Brad",
                favbook: 2,
                parent: 1,
              },
            ],
          },
        });
      const translateIds = uploadResp._body.translateIds;
      expect(translateIds).toBeDefined();
      expect(Object.keys(translateIds).length).toBe(0);

      const adminCookie = await getAdminLoginCookie();
      const downloadResp = await request(app)
        .get("/sync/table_data")
        .set("Cookie", adminCookie);
      const data = downloadResp._body;
      expect(data.patients.rows.length).toBe(2);
    });

    it("upload patients and books", async () => {
      const app = await getApp({ disableCsrf: true });
      const adminCookie = await getAdminLoginCookie();
      const uploadResp = await request(app)
        .post("/sync/table_data")
        .set("Cookie", adminCookie)
        .send({
          data: {
            patients: [
              {
                name: "Brad Pitt",
                favbook: 2,
                parent: 1,
              },
              {
                id: 84, // will be translated to 3
                name: "Pitt Brad",
                favbook: 2,
                parent: 1,
              },
            ],
            books: [
              {
                id: 3, // stays at 3
                author: "foo",
                pages: 20,
                publisher: 1,
              },
            ],
          },
        });
      const translateIds = uploadResp._body.translateIds;
      expect(translateIds).toBeDefined();
      expect(Object.keys(translateIds).length).toBe(1);
      expect(translateIds.patients.length).toBe(1);
      expect(translateIds.patients[0]).toEqual({ from: 84, to: 3 });

      const staffCookie = await getStaffLoginCookie();
      const downloadResp = await request(app)
        .get("/sync/table_data")
        .set("Cookie", staffCookie);
      const data = downloadResp._body;
      expect(data.patients.rows.length).toBe(3);
      expect(data.books.rows.length).toBe(3);
    });

    it("upload with ownership_field", async () => {
      const messagesTbl = Table.findOne({ name: "messages" });
      const userField = messagesTbl
        .getFields()
        .find((field) => field.name === "user");
      await messagesTbl.update({
        min_role_read: 1,
        min_role_write: 1,
        ownership_field_id: userField.id,
      });
      const staffMsgId = await db.insert("messages", {
        content: "message from staff",
        user: 2,
        room: 1,
      });
      const userMsgId = await db.insert("messages", {
        content: "message from user",
        user: 3,
        room: 1,
      });

      const app = await getApp({ disableCsrf: true });
      const userCookie = await getUserLoginCookie();
      const uploadResp = await request(app)
        .post("/sync/table_data")
        .set("Cookie", userCookie)
        .send({
          data: {
            messages: [
              {
                id: staffMsgId, // will be skipped
                user: 3,
                room: 1,
                content: "offline change",
              },
              {
                id: userMsgId, // will be updated because user is the owner
                user: 2,
                room: 1,
                content: "offline change",
              },
            ],
          },
        });
      const translateIds = uploadResp._body.translateIds;
      expect(translateIds).toBeDefined();
      expect(Object.keys(translateIds).length).toBe(0);
      // load the admin data
      const adminCookie = await getAdminLoginCookie();
      const resp = await request(app)
        .get("/sync/table_data")
        .set("Cookie", adminCookie);
      const data = resp._body;
      expect(data.messages.rows.length).toBe(4);
    });
  }
});
