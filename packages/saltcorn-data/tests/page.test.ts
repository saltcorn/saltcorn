import Page from "../models/page";
import File from "../models/file";
import db from "../db";
const { getState } = require("../db/state");
import { assertIsSet } from "./assertions";
import { afterAll, describe, it, expect, beforeAll, jest } from "@jest/globals";
import mocks from "./mocks";
const { mockReqRes } = mocks;
getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

describe("Page model tests", () => {
  it("returns html-file without additional layout", async () => {
    const page = Page.findOne({ name: "page_with_html_file" });
    assertIsSet(page);
    const content = await page.run({}, mockReqRes);
    expect(content).toEqual({ html_file: "test.html" });
  });
  it("runs views in html file", async () => {
    await File.from_contents(
      "test_embed.html",
      "text/html",
      `<html>
<head>
    <title>title</title>
</head>
<body>
    <h1>new html</h1>
    <embed-view viewname="authorlist" bar="23">
</body></html>`,
      1,
      100
    );

    const page = await Page.create({
      name: "page_with_html_embed",
      title: "grgw",
      description: "rgerg",
      min_role: 100,
      layout: { html_file: "test_embed.html" },
    });
    const content = (await page.run({}, mockReqRes)) as any;
    expect(typeof content.html_string).toEqual("string");
    expect(content.html_string).toContain("Herman Melville");
  });
});
