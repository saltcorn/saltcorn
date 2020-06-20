const Table = require("../models/table");
const Field = require("../models/field");
const View = require("../models/view");
const db = require("../db");

const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);

const mockReqRes = { req: { csrfToken: () => "" }, res: { redirect() {} } };

describe("View", () => {
  it("should run with no query", async () => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.run({}, mockReqRes);
    expect(res.length > 0).toBe(true);
  });
  it("should run with string query", async () => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.run({ author: "Mel" }, mockReqRes);

    expect(res.length > 0).toBe(true);
  });
  it("should run with integer query as int", async () => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.run({ pages: 967 }, mockReqRes);

    expect(res.length > 0).toBe(true);
  });
  it("should run with integer query as string", async () => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.run({ pages: "967" }, mockReqRes);
    expect(res.length > 0).toBe(true);
  });
  it("should render list state form", async () => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.get_state_form({});
    expect(res.constructor.name).toBe("Form");
    expect(res.fields.length > 0).toBe(true);
  });
  it("should get config flow", async () => {
    const v = await View.findOne({ name: "authorlist" });
    const res = await v.get_config_flow();
    expect(res.constructor.name).toBe("Workflow");
    expect(res.steps.length > 0).toBe(true);
  });
  it("should runMany with no query", async () => {
    const v = await View.findOne({ name: "authorshow" });
    const res = await v.runMany({}, mockReqRes);
    expect(res.length > 0).toBe(true);
  });
  it("should runPost", async () => {
    const v = await View.findOne({ name: "authoredit" });
    await v.runPost({}, { author: "James Joyce" }, mockReqRes);
    const rows = await db.select("books", {});
    expect(rows).toContainEqual({ author: "James Joyce", id: 3, pages: 678 });
  });
  it("should find", async () => {
    const link_views = await View.find({
      table_id: 1
    });
    expect(link_views.length).toBe(3);
  });
  it("should find where", async () => {
    const link_views = await View.find_all_views_where(
      ({ viewrow }) => viewrow.name === "authorshow"
    );
    expect(link_views.length).toBe(1);
  });
});
