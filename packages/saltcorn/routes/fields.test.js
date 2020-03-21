const request = require("supertest");
const app = require("../app");
const Field = require("../models/field");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude
} = require("../auth/testhelp");

describe("Field Endpoints", () => {
  itShouldRedirectUnauthToLogin("/field/1");

  it("should show existing", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .get("/field/1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Label"));
    done();
  });

  it("should new form", async done => {
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .get("/field/new/1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Label"));
    done();
  });

  it("should post new int field", async done => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(JSON.stringify({ table_id: 1 }));
    const res = await request(app)
      .post("/field/")
      .send("stepName=field")
      .send("name=AgeRating")
      .send("label=AgeRating")
      .send("type=Integer")
      .send("contextEnc=" + ctx)
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(200);

    done();
  });

  it("should post new int field with attributes", async done => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: 1,
        name: "AgeRating",
        label: "AgeRating",
        type: "Integer",
        required: false
      })
    );

    const res = await request(app)
      .post("/field/")
      .send("stepName=attributes")
      .send("contextEnc=" + ctx)
      .send("min=0")
      .send("max=410")
      .set("Cookie", loginCookie);
    if (res.statusCode === 500) console.log(res.text);
    expect(res.statusCode).toEqual(302);

    done();
  });

  it("should post new string field", async done => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(JSON.stringify({ table_id: 1 }));

    const res = await request(app)
      .post("/field/")
      .send("stepName=field")
      .send("name=Publisher")
      .send("label=Publisher")
      .send("type=String")
      .send("contextEnc=" + ctx)
      .set("Cookie", loginCookie)
      .expect(toInclude("match"));

    done();
  });

  it("should post new fkey field", async done => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(JSON.stringify({ table_id: 2 }));
    const res = await request(app)
      .post("/field/")
      .send("stepName=field")
      .send("name=wrote")
      .send("label=wrote")
      .send("type=Key+to+books")
      .send("contextEnc=" + ctx)
      .set("Cookie", loginCookie)
      .expect(toInclude("pages"));

    done();
  });

  it("should post new fkey field with summary", async done => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: 2,
        name: "wrote",
        label: "Wrote",
        type: "Key to books",
        required: false
      })
    );

    const res = await request(app)
      .post("/field/")
      .send("stepName=summary")
      .send("contextEnc=" + ctx)
      .send("summary_field=pages")
      .set("Cookie", loginCookie);
    if (res.statusCode === 500) console.log(res.text);
    expect(res.statusCode).toEqual(302);

    done();
  });

  it("should delete field", async done => {
    const loginCookie = await getAdminLoginCookie();
    const fld = await Field.findOne({ name: "AgeRating" });
    const res = await request(app)
      .post(`/field/delete/${fld.id}`)
      .set("Cookie", loginCookie);
    expect(res.statusCode).toEqual(302);

    done();
  });
});
