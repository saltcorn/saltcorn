const request = require("supertest");
const getApp = require("../app");
const {
  getUserLoginCookie,
  getAdminLoginCookie,
  resetToFixtures,
  notAuthorized,
  respondJsonWith,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");

const Table = require("@saltcorn/data/models/table");

beforeAll(async () => {
  await resetToFixtures();
});
afterAll(db.close);

describe("Synchronise with mobile offline data", () => {
  it("not permitted", async () => {
    if (!db.isSQLite) {
      const patients = Table.findOne({ name: "patients" });
      const books = Table.findOne({ name: "books" });
      const patientsBefore = await patients.countRows();
      const booksBefore = await books.countRows();
      const app = await getApp({ disableCsrf: true });
      const loginCookie = await getUserLoginCookie();
      await request(app)
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
            books: [
              {
                id: 3,
                author: "foo",
                pages: 20,
                publisher: 1,
              },
            ],
          },
        })
        .expect(notAuthorized);
      const patientsAfter = await patients.countRows();
      const booksAfter = await books.countRows();
      expect(patientsAfter).toBe(patientsBefore);
      expect(booksAfter).toBe(booksBefore);
    }
  });

  it("upload patients and books", async () => {
    if (!db.isSQLite) {
      const patients = Table.findOne({ name: "patients" });
      const books = Table.findOne({ name: "books" });
      const patientsBefore = await patients.countRows();
      const booksBefore = await books.countRows();
      const app = await getApp({ disableCsrf: true });
      const loginCookie = await getAdminLoginCookie();
      await request(app)
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
            books: [
              {
                id: 3,
                author: "foo",
                pages: 20,
                publisher: 1,
              },
            ],
          },
        })
        .expect(respondJsonWith(200, ({ success }) => success));
      const patientsAfter = await patients.countRows();
      const booksAfter = await books.countRows();
      expect(patientsAfter).toBe(patientsBefore + 2);
      expect(booksAfter).toBe(booksBefore + 1);
      expect((await patients.getRows({ id: 84 })).length).toBe(0);
    }
  });
});
