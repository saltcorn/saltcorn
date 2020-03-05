const request = require("supertest");
const app = require("../app");
const Table = require("../db/table");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin
} = require("../auth/testhelp");

describe("Field Endpoints", () => {
  itShouldRedirectUnauthToLogin("/field/1");

  it("should show existing", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .get("/field/1")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);

    expect(res.text.includes("Label")).toBe(true);
    done();
  });

  it("should new form", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .get("/field/new/1")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);

    expect(res.text.includes("Label")).toBe(true);
    done();
  });

  it("should post new int field", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .post("/field/")
      .send("table_id=1")
      .send("fname=AgeRating")
      .send("flabel=AgeRating")
      .send("ftype=Integer")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);

    done();
  });
  it("should post new string field", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .post("/field/")
      .send("table_id=1")
      .send("fname=AgeRating")
      .send("flabel=AgeRating")
      .send("ftype=String")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);

    done();
  });
});
