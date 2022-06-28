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
});

describe("MJML layout", () => {
  it("renders empty layout", () => {
    const blockDispatch = {};
    const layout = { above: [] };
    expect(renderMJML({ blockDispatch: {}, layout: {} })).toBe("");
  });
});
