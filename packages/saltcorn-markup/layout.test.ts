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
      '<div class="row"><div class="col-6">hello</div><div class="col-6">world</div></div><div class="row"><div class="col-6">bar</div><div class="col-6">foo</div></div>'
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
  it("renders styled text in container with single textStyle", () => {
    const blockDispatch = {};
    const markup = {
      type: "container",
      contents: { type: "blank", contents: "bar", textStyle: "h1" },
    };
    expect(render({ blockDispatch, layout: markup })).toBe(
      '<div style="    "><h1>bar</h1></div>'
    );
    const markup1 = {
      type: "container",
      contents: { type: "blank", contents: "bar", textStyle: "fw-bold" },
    };
    expect(render({ blockDispatch, layout: markup1 })).toBe(
      '<div style="    "><span class="fw-bold">bar</span></div>'
    );
  });
  it("renders styled text in container with array textStyle", () => {
    const blockDispatch = {};
    const markup = {
      type: "container",
      contents: { type: "blank", contents: "bar", textStyle: ["h1"] },
    };
    expect(render({ blockDispatch, layout: markup })).toBe(
      '<div style="    "><h1>bar</h1></div>'
    );
    const markup1 = {
      type: "container",
      contents: {
        type: "blank",
        contents: "bar",
        textStyle: ["fw-bold", "small"],
      },
    };
    expect(render({ blockDispatch, layout: markup1 })).toBe(
      '<div style="    "><span class="fw-bold small">bar</span></div>'
    );
    const markup2 = {
      type: "container",
      contents: {
        type: "blank",
        contents: "bar",
        textStyle: ["h1", "fw-bold", "small"],
      },
    };
    expect(render({ blockDispatch, layout: markup2 })).toBe(
      '<div style="    "><h1 class="fw-bold small">bar</h1></div>'
    );
  });
  it("renders top-level text styled with array textStyle", () => {
    const blockDispatch = {};
    const markup = {
      type: "blank",
      contents: "bar",
      textStyle: ["h1"],
    };
    expect(render({ blockDispatch, layout: markup })).toBe("<h1>bar</h1>");
    const markup1 = {
      type: "blank",
      contents: "bar",
      textStyle: ["fw-bold", "small"],
    };
    expect(render({ blockDispatch, layout: markup1 })).toBe(
      '<span class="fw-bold small">bar</span>'
    );
  });
  it("renders text with class", () => {
    const blockDispatch = {};
    expect(
      render({
        blockDispatch,
        layout: {
          type: "blank",
          contents: "bar",
          customClass: ["myclass"],
        },
      })
    ).toBe('<span class="myclass">bar</span>');
    expect(
      render({
        blockDispatch,
        layout: {
          type: "blank",
          contents: "bar",
          textStyle: ["h1"],
          customClass: ["myclass"],
        },
      })
    ).toBe('<h1 class="myclass">bar</h1>');
    expect(
      render({
        blockDispatch,
        layout: {
          type: "blank",
          contents: "bar",
          textStyle: ["muted"],
          customClass: ["myclass"],
        },
      })
    ).toBe('<span class="muted myclass">bar</span>');
    expect(
      render({
        blockDispatch,
        layout: {
          type: "container",
          contents: {
            type: "blank",
            contents: "bar",
            customClass: ["myclass"],
          },
        },
      })
    ).toBe('<div style="    "><span class="myclass">bar</span></div>');
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
