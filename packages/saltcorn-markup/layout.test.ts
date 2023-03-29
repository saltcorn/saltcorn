import { describe, it, expect } from "@jest/globals";
import render = require("./layout");
import renderMJML = require("./mjml-layout");

import tags = require("./tags");
const { p } = tags;

describe("layout", () => {
  it("renders a simple layout", () => {
    const blockDispatch = {
      wrapTop(segment: any, ix: number, s: string) {
        return p(s);
      },
      reverseIt({ theString }: { theString: string }) {
        return theString.split("").reverse().join("");
      },
    };
    const markup = { above: [{ type: "reverseIt", theString: "foobar" }] };
    expect(render({ blockDispatch, layout: markup })).toBe("<p>raboof</p>");
  });
  it("renders a nested layout", () => {
    const blockDispatch = {};
    const markup = {
      above: [
        {
          besides: [
            { type: "blank", contents: "hello" },
            { type: "blank", contents: "world" },
          ],
        },
        {
          besides: [
            { type: "blank", contents: "bar" },
            { type: "blank", contents: "foo" },
          ],
        },
      ],
    };
    expect(render({ blockDispatch, layout: markup })).toBe(
      '<div class="row w-100"><div class="col-6">hello</div><div class="col-6">world</div></div><div class="row w-100"><div class="col-6">bar</div><div class="col-6">foo</div></div>'
    );
  });
  it("renders a container with padding", () => {
    const blockDispatch = {};
    const markup = {
      type: "container",
      style: {
        padding: "2rem",
      },
      contents: { type: "blank", contents: "bar" },
    };
    expect(render({ blockDispatch, layout: markup })).toBe(
      '<div style="padding:2rem;    ">bar</div>'
    );
  });
});

describe("MJML layout", () => {
  const blockDispatch = {};
  it("renders empty layout", () => {
    const result = renderMJML({ blockDispatch, layout: {}, req: {} });
    expect(result.markup).toBe(
      `<mj-section><mj-raw><div style="text-align: left !important; font-size: 16px;"></div></mj-raw></mj-section>`
    );
    expect(result.backgroundColor).toBe(undefined);
  });
  it("renders text layout", () => {
    const layout = { type: "blank", contents: "Hello world" };
    const result = renderMJML({ blockDispatch, layout, req: {} });
    expect(result.markup).toBe(
      `<mj-section><mj-raw><div style="text-align: left !important; font-size: 16px;">Hello world</div></mj-raw></mj-section>`
    );
    expect(result.backgroundColor).toBe(undefined);
  });
  it("renders text header", () => {
    const layout = { type: "blank", contents: "Hello world", textStyle: "h1" };
    const result = renderMJML({ blockDispatch, layout, req: {} });
    expect(result.markup).toBe(
      `<mj-section><mj-raw><div style=\"text-align: left !important; font-size: 16px;\"><div style=\"font-size:2em;margin-top:0.67em;margin-bottom:0.67em;margin-left:0;margin-right:0;font-weight:bold\">Hello world</div></div></mj-raw></mj-section>`
    );
    expect(result.backgroundColor).toBe(undefined);
  });
});
