import Page from "../models/page.js";
import File from "../models/file.js";
import db from "../db/index.js";
import { assertIsSet } from "./assertions.js";
import { afterAll, describe, it, expect, beforeAll, jest } from "@saltcorn/db-common/test_expect";
import * as mocks from "./mocks.js";
import { getState } from "../db/state.js";
import basePluginMod from "../base-plugin/index.js";
import resetSchemaMod from "../db/reset_schema.js";
import fixturesMod from "../db/fixtures.js";
const { mockReqRes } = mocks;
getState()!.registerPlugin("base", basePluginMod);

afterAll(db.close);
beforeAll(async () => {
  await resetSchemaMod();
  await fixturesMod();
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

  it("replaces all embed-view tags, not just the first", async () => {
    await File.from_contents(
      "test_multi_embed.html",
      "text/html",
      `<html><body>
<div id="a"><embed-view viewname="authorlist" /></div>
<div id="b"><embed-view viewname="authorlist" /></div>
</body></html>`,
      1,
      100
    );
    const page = await Page.create({
      name: "page_multi_embed",
      title: "multi",
      description: "",
      min_role: 100,
      layout: { html_file: "test_multi_embed.html" },
    });
    const content = (await page.run({}, mockReqRes)) as any;
    expect(content.html_string).not.toContain("<embed-view");
    const matches = (content.html_string.match(/Herman Melville/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(2);
  });

  it("handles self-closing embed-view tags", async () => {
    await File.from_contents(
      "test_selfclose_embed.html",
      "text/html",
      `<html><body><embed-view viewname="authorlist" /></body></html>`,
      1,
      100
    );
    const page = await Page.create({
      name: "page_selfclose_embed",
      title: "selfclose",
      description: "",
      min_role: 100,
      layout: { html_file: "test_selfclose_embed.html" },
    });
    const content = (await page.run({}, mockReqRes)) as any;
    expect(content.html_string).not.toContain("<embed-view");
    expect(content.html_string).toContain("Herman Melville");
  });

  it("skips embed-view with unknown view name without crashing", async () => {
    await File.from_contents(
      "test_unknown_embed.html",
      "text/html",
      `<html><body><p>before</p><embed-view viewname="no_such_view" /><p>after</p></body></html>`,
      1,
      100
    );
    const page = await Page.create({
      name: "page_unknown_embed",
      title: "unknown",
      description: "",
      min_role: 100,
      layout: { html_file: "test_unknown_embed.html" },
    });
    const content = (await page.run({}, mockReqRes)) as any;
    expect(content.html_string).toContain("before");
    expect(content.html_string).toContain("after");
  });
});
