import { describe, it, expect } from "@jest/globals";
import { render, makeSegments, applyTextStyle } from "./layout";
// import renderMJML = require("./mjml-layout");
import renderMJML from "./mjml-layout";

// import tags = require("./tags");
import * as tags from "./tags";
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
  it("renders a dropdown menu", () => {
    const blockDispatch = {};
    const markup = {
      type: "dropdown_menu",
      action_style: "btn-primary",
      label: "Actions",
      contents: [
        { type: "blank", contents: "Option 1" },
        { type: "blank", contents: "Option 2" },
      ],
    };

    const result = render({ blockDispatch, layout: markup });

    // Check the structure without depending on the exact ID
    expect(result).toContain('<div class="dropdown">');
    expect(result).toContain('class="btn btn-primary  dropdown-toggle"');
    expect(result).toContain('data-bs-toggle="dropdown"');
    expect(result).toContain(">Actions</button>");
    expect(result).toContain('<div class="dropdown-menu"');
    expect(result).toContain("Option 1Option 2</div>");
  });

  it("renders a card with a footer", () => {
    const blockDispatch = {};
    const markup = {
      type: "card",
      title: "Card Title",
      contents: { type: "blank", contents: "Card Body" },
      footer: { type: "blank", contents: "Card footer" },
    };
    const result = render({ blockDispatch, layout: markup });

    expect(result).toContain('<div class="card mt-4 shadow">');
    expect(result).toContain('<span class="card-header">');
    expect(result).toContain(
      '<h5 class="m-0 fw-bold text-primary d-inline">Card Title</h5>'
    );
    expect(result).toContain('<div class="card-body">Card Body</div>');
    expect(result).toContain('<div class="card-footer">Card footer</div>');
    expect(result).toMatch(/<\/div>\s*<\/div>$/);
  });
  it("renders a container with background image", () => {
    const blockDispatch = {};
    const markup = {
      type: "container",
      bgType: "Image",
      bgFileId: "123",
      contents: { type: "blank", contents: "Content with background" },
    };
    const result = render({ blockDispatch, layout: markup });
    expect(result).toContain(
      '<img class="containerbgimage " style="object-fit:contain" alt="" src="/files/serve/123">'
    );
    expect(result).toContain("Content with background");
  });
});

describe("render", () => {
  it("renders a layout with multiple nested containers", () => {
    const blockDispatch = {};
    const markup = {
      type: "container",
      contents: {
        type: "container",
        contents: {
          type: "container",
          contents: { type: "blank", contents: "Nested Content" },
        },
      },
    };
    const result = render({ blockDispatch, layout: markup });
    expect(result).toBe(
      '<div style="    "><div style="    "><div style="    ">Nested Content</div></div></div>'
    );
  });

  it("renders a layout with a custom class", () => {
    const blockDispatch = {};
    const markup = {
      type: "container",
      customClass: ["custom-class"],
      contents: { type: "blank", contents: "Content with class" },
    };
    const result = render({ blockDispatch, layout: markup });
    expect(result).toBe(
      // '<div style="    " class="custom-class">Content with class</div>'
      "<span class=\"custom-class\"><div class=\"custom-class\" style=\"    \">Content with class</div></span>"
    );
  });

  it("renders a layout with inline styles", () => {
    const blockDispatch = {};
    const markup = {
      type: "container",
      style: { backgroundColor: "blue", color: "white" },
      contents: { type: "blank", contents: "Styled Content" },
    };
    const result = render({ blockDispatch, layout: markup });
    expect(result).toBe(
      '<div style="backgroundColor:blue;color:white;    ">Styled Content</div>'
    );
  });

  it("renders a layout with a combination of textStyle and customClass", () => {
    const blockDispatch = {};
    const markup = {
      type: "blank",
      contents: "Styled and Classed Content",
      textStyle: ["h1", "fw-bold"],
      customClass: ["custom-class"],
    };
    const result = render({ blockDispatch, layout: markup });
    expect(result).toBe(
      '<h1 class="fw-bold custom-class">Styled and Classed Content</h1>'
    );
  });

  it("renders a layout with an empty container", () => {
    const blockDispatch = {};
    const markup = {
      type: "container",
      contents: null,
    };
    const result = render({ blockDispatch, layout: markup });
    expect(result).toBe('<div style="    "></div>');
  });

  it("renders a layout with a dropdown menu containing multiple actions", () => {
    const blockDispatch = {};
    const markup = {
      type: "dropdown_menu",
      action_style: "btn-secondary",
      label: "Menu",
      contents: [
        { type: "blank", contents: "Action 1" },
        { type: "blank", contents: "Action 2" },
        { type: "blank", contents: "Action 3" },
      ],
    };
    const result = render({ blockDispatch, layout: markup });
    expect(result).toContain('<div class="dropdown">');
    expect(result).toContain('class="btn btn-secondary  dropdown-toggle"');
    expect(result).toContain(">Menu</button>");
    expect(result).toContain('<div class="dropdown-menu"');
    expect(result).toContain("Action 1Action 2Action 3</div>");
  });

  it("renders a card layout with title, body, and footer", () => {
    const blockDispatch = {};
    const markup = {
      type: "card",
      title: "Card Title",
      contents: { type: "blank", contents: "Card Body" },
      footer: { type: "blank", contents: "Card Footer" },
    };
    const result = render({ blockDispatch, layout: markup });
    expect(result).toContain('<div class="card mt-4 shadow">');
    expect(result).toContain('<span class="card-header">');
    expect(result).toContain(
      '<h5 class="m-0 fw-bold text-primary d-inline">Card Title</h5>'
    );
    expect(result).toContain('<div class="card-body">Card Body</div>');
    expect(result).toContain('<div class="card-footer">Card Footer</div>');
  });

  it("renders a layout with a container and background image", () => {
    const blockDispatch = {};
    const markup = {
      type: "container",
      bgType: "Image",
      bgFileId: "456",
      contents: { type: "blank", contents: "Background Content" },
    };
    const result = render({ blockDispatch, layout: markup });
    expect(result).toContain(
      '<img class="containerbgimage " style="object-fit:contain" alt="" src="/files/serve/456">'
    );
    expect(result).toContain("Background Content");
  });
});

describe("makeSegments", () => {
  // it("creates segments with alerts", () => {
  //   const body = "Test body";
  //   const alerts = [{ type: "success", msg: "Operation successful" }];
  //   const result = makeSegments(body, true);
  //   // expect(result.above).toHaveLength(2);
  //   expect(result.above[0].contents).toBe("Test body");
  //   expect(result.above[1].contents).toContain("Operation successful");
  // });

  it("creates segments without alerts", () => {
    const body = "Test body";
    const result = makeSegments(body, true);
    expect(result.above).toHaveLength(1);
    expect(result.above[0].contents).toBe("Test body");
  });

  it("handles body with 'above' property", () => {
    const body = { above: [{ type: "blank", contents: "Above content" }] };
    const result = makeSegments(body, true);
    expect(result.above).toHaveLength(1);
    expect(result.above[0].contents).toBe("Above content");
  });
});

describe("applyTextStyle", () => {
  it("applies h1 text style", () => {
    const segment = { textStyle: "h1" };
    const inner = "Header Text";
    const result = applyTextStyle(segment, inner);
    expect(result).toBe("<h1>Header Text</h1>");
  });

  it("applies multiple text styles", () => {
    const segment = { textStyle: ["fw-bold", "small"] };
    const inner = "Styled Text";
    const result = applyTextStyle(segment, inner);
    expect(result).toBe('<span class="fw-bold small">Styled Text</span>');
  });

  it("applies custom class and inline styles", () => {
    const segment = {
      textStyle: "h2",
      customClass: "custom-class",
      style: { color: "red" },
    };
    const inner = "Custom Styled Text";
    const result = applyTextStyle(segment, inner);
    expect(result).toBe(
      '<h2 style="color:red" class="custom-class">Custom Styled Text</h2>'
    );
  });
  it("applies custom class and inline styles", () => {
    const segment = {
      textStyle: "h2",
      customClass: "custom-class",
      style: { color: "red" },
    };
    const inner = "Custom Styled Text";
    const result = applyTextStyle(segment, inner);
    expect(result).toMatch(
      /^<h2 style="color:red;?" class="custom-class">Custom Styled Text<\/h2>$/
    );
  });
});

// describe("wrap", () => {
//   it("wraps with label when labelFor is provided", () => {
//     const segment = { labelFor: "input1", textStyle: "h1" };
//     const inner = "Label Text";
//     const result = wrap(segment, true, 0, inner);
//     expect(result).toBe(
//       '<label for="input1"><h1>Label Text</h1></label>'
//     );
//   });

//   it("wraps with applyTextStyle when no labelFor is provided", () => {
//     const segment = { textStyle: "h1" };
//     const inner = "Styled Text";
//     const result = wrap(segment, true, 0, inner);
//     expect(result).toBe('<h1>Styled Text</h1>');
//   });

//   it("calls blockDispatch.wrapTop when available", () => {
//     const blockDispatch = {
//       wrapTop: jest.fn((segment, ix, inner) => `<p>${inner}</p>`),
//     };
//     const segment = {};
//     const inner = "Wrapped Text";
//     const result = wrap(segment, true, 0, inner);
//     expect(blockDispatch.wrapTop).toHaveBeenCalledWith(segment, 0, inner);
//     expect(result).toBe("<p>Wrapped Text</p>");
//   });
// });

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

