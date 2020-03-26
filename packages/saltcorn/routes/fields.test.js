const request = require("supertest");
const app = require("../app");
const Field = require("saltcorn-data/models/field");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  toRedirect
} = require("../auth/testhelp");

describe("Field Endpoints", () => {
  itShouldRedirectUnauthToLogin("/field/1");

  it("should show existing", async done => {
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/field/1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Label"));
    done();
  });

  it("should new form", async done => {
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/field/new/1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Label"));
    done();
  });

  it("should post new int field", async done => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(JSON.stringify({ table_id: 1 }));
    await request(app)
      .post("/field/")
      .send("stepName=field")
      .send("name=AgeRating")
      .send("label=AgeRating")
      .send("type=Integer")
      .send("contextEnc=" + ctx)
      .set("Cookie", loginCookie)
      .expect(200);

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

    await request(app)
      .post("/field/")
      .send("stepName=attributes")
      .send("contextEnc=" + ctx)
      .send("min=0")
      .send("max=410")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/table/1"));

    done();
  });

  it("should post new string field", async done => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(JSON.stringify({ table_id: 1 }));

    await request(app)
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
    await request(app)
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

  it("should post new nonrequired fkey field with summary", async done => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: 2,
        name: "cowrote",
        label: "cowrote",
        type: "Key to books",
        required: false
      })
    );

    await request(app)
      .post("/field/")
      .send("stepName=summary")
      .send("contextEnc=" + ctx)
      .send("summary_field=pages")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/table/2"));

    done();
  });

  it("should post new required fkey field with summary", async done => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: 2,
        name: "wrote",
        label: "Wrote",
        type: "Key to books",
        summary_field: "pages",
        required: true
      })
    );

    await request(app)
      .post("/field/")
      .send("stepName=default")
      .send("contextEnc=" + ctx)
      .send("summary_field=pages")
      .send("default=1")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/table/2"));

    done();
  });

  it("should show field in table", async done => {
    const loginCookie = await getAdminLoginCookie();

    await request(app)
      .get(`/table/2`)
      .set("Cookie", loginCookie)
      .expect(toInclude("wrote"))
      .expect(toNotInclude("[object"));
    done();
  });

  it("should delete field", async done => {
    const loginCookie = await getAdminLoginCookie();
    const fld = await Field.findOne({ name: "AgeRating" });
    await request(app)
      .post(`/field/delete/${fld.id}`)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/table/1"));

    done();
  });
});
