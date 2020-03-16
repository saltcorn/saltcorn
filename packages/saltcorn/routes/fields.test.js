const request = require("supertest");
const app = require("../app");
const Table = require("../models/table");
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
      .send("stepName=field")
      .send("name=AgeRating")
      .send("label=AgeRating")
      .send("type=Integer")
      .send("contextEnc=" + encodeURIComponent(JSON.stringify({ table_id: 1 })))
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);

    done();
  });
  /*
  it("should post new int field with attributes", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .post("/field/")
      .send("table_id=1")
      .send("name=AgeRating")
      .send("label=AgeRating")
      .send("type=Integer")
      .send("min=0")
      .send("max=410")
      .send("has_attributes=true")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(302);

    done();
  });
  it("should post new string field", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .post("/field/")
      .send("table_id=1")
      .send("name=Publisher")
      .send("label=Publisher")
      .send("type=String")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);

    done();
  });

  it("should post new string field with attributes", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .post("/field/")
      .send("table_id=1")
      .send("name=Publisher")
      .send("label=Publisher")
      .send("type=String")
      .send("has_attributes=true")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(302);

    done();
  });

  it("should delete field", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .post("/field/delete/3")
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(302);

    done();
  });*/
});
