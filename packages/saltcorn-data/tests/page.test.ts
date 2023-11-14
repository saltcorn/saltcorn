import Page from "../models/page";
import db from "../db";
const { getState } = require("../db/state");
import { assertIsSet } from "./assertions";
import mocks from "./mocks";
const { mockReqRes } = mocks;
getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

describe("Page", () => {
  it("returns html-file without additional layout", async () => {
    const page = Page.findOne({ name: "page_with_html_file" });
    assertIsSet(page);
    const content = await page.run({}, mockReqRes);
    expect(content).toEqual({ html_file: "test.html" });
  });
});
