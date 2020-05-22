const request = require("supertest");
const getApp = require("../app");
const Field = require("@saltcorn/data/models/field");
const {
  getStaffLoginCookie,
  getAdminLoginCookie,
  itShouldRedirectUnauthToLogin,
  toInclude,
  toNotInclude,
  toRedirect
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");

afterAll(db.close);

describe("Field Endpoints", () => {
  itShouldRedirectUnauthToLogin("/field/1");

  it("should show existing", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp();
    await request(app)
      .get("/field/1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Label"));
  });

  it("should new form", async () => {
    const loginCookie = await getAdminLoginCookie();
    const app = await getApp();
    await request(app)
      .get("/field/new/1")
      .set("Cookie", loginCookie)
      .expect(toInclude("Label"));
  });

  it("should post new int field", async () => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(JSON.stringify({ table_id: 1 }));
    const app = await getApp();
    await request(app)
      .post("/field/")
      .send("stepName=field")
      .send("name=AgeRating")
      .send("label=AgeRating")
      .send("type=Integer")
      .send("contextEnc=" + ctx)
      .set("Cookie", loginCookie)
      .expect(200);
  });

  it("should post new int field with attributes", async () => {
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

    const app = await getApp();
    await request(app)
      .post("/field/")
      .send("stepName=attributes")
      .send("contextEnc=" + ctx)
      .send("min=0")
      .send("max=410")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/table/1"));
  });
  it("should delete new field", async () => {
    const loginCookie = await getAdminLoginCookie();
    const fld = await Field.findOne({ name: "AgeRating" });
    const app = await getApp();
    await request(app)
      .post(`/field/delete/${fld.id}`)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/table/1"));
  });
  it("should post new string field", async () => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(JSON.stringify({ table_id: 1 }));

    const app = await getApp();
    await request(app)
      .post("/field/")
      .send("stepName=field")
      .send("name=Publisher")
      .send("label=Publisher")
      .send("type=String")
      .send("contextEnc=" + ctx)
      .set("Cookie", loginCookie)
      .expect(toInclude("match"));
  });

  it("should post new fkey field", async () => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(JSON.stringify({ table_id: 2 }));
    const app = await getApp();
    await request(app)
      .post("/field/")
      .send("stepName=field")
      .send("name=wrote")
      .send("label=wrote")
      .send("type=Key+to+books")
      .send("contextEnc=" + ctx)
      .set("Cookie", loginCookie)
      .expect(toInclude("pages"));
  });

  it("should post new nonrequired fkey field with summary", async () => {
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

    const app = await getApp();
    await request(app)
      .post("/field/")
      .send("stepName=summary")
      .send("contextEnc=" + ctx)
      .send("summary_field=pages")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/table/2"));
  });

  it("should post new required fkey field with summary", async () => {
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

    const app = await getApp();
    await request(app)
      .post("/field/")
      .send("stepName=default")
      .send("contextEnc=" + ctx)
      .send("summary_field=pages")
      .send("default=1")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/table/2"));
  });

  it("should post new required string field", async () => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: 2,
        name: "zowrote",
        label: "ZoWrote",
        type: "String",
        required: true
      })
    );

    const app = await getApp();
    await request(app)
      .post("/field/")
      .send("stepName=default")
      .send("contextEnc=" + ctx)
      .send("default=foo")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/table/2"));
  });
  it("should post new required int field", async () => {
    const loginCookie = await getAdminLoginCookie();
    const ctx = encodeURIComponent(
      JSON.stringify({
        table_id: 2,
        name: "weight",
        label: "weight",
        type: "Integer",
        required: true
      })
    );

    const app = await getApp();
    await request(app)
      .post("/field/")
      .send("stepName=default")
      .send("contextEnc=" + ctx)
      .send("default=56")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/table/2"));
  });

  it("should show field in table", async () => {
    const loginCookie = await getAdminLoginCookie();

    const app = await getApp();
    await request(app)
      .get(`/table/2`)
      .set("Cookie", loginCookie)
      .expect(toInclude("wrote"))
      .expect(toInclude("ZoWrote"))
      .expect(toInclude("weight"))
      .expect(toNotInclude("[object"));
  });
});
