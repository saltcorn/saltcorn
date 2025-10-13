import { describe, it, expect } from "@jest/globals";
import {
  isBlock,
  transformTextStyle,
  transformLinkSize,
  applyTextStyle,
  renderMJML,
} from "./mjml-layout";
import * as tags from "./tags";
import * as mjml from "./mjml-tags";
import tabs from "./tabs";
import mkTable from "./table";
// import index = require("./index");
import index from "./index";
import builder from "./builder";

const {
  post_btn,
  post_delete_btn,
  post_dropdown_item,
  settingsDropdown,
  localeDate,
} = index;

const { a, input, div, ul, text, text_attr, i, hr, genericElement } = tags;

describe("tags", () => {
  it("renders", () => {
    expect(a({ href: "/" }, "Home")).toBe('<a href="/">Home</a>');
    expect(a({ href: "/" }, ["Home", " Sweet", " Home"])).toBe(
      '<a href="/">Home Sweet Home</a>'
    );
    expect(a({ href: "/", class: "centre" }, "Home")).toBe(
      '<a href="/" class="centre">Home</a>'
    );
    expect(input({ type: "text" })).toBe('<input type="text">');
    expect(div(5)).toBe("<div>5</div>");
    expect(div()).toBe("<div></div>");
    expect(div(null)).toBe("<div></div>");
    expect(div("Hello world")).toBe("<div>Hello world</div>");
    expect(div(["Hello world"])).toBe("<div>Hello world</div>");
    expect(i()).toBe("<i></i>");
    expect(hr()).toBe("<hr>");
    expect(div(["hello ", "world"])).toBe("<div>hello world</div>");
    expect(ul({ class: "foo" }, [false, "hello ", "world"])).toBe(
      `<ul class="foo">hello world</ul>`
    );
    expect(ul({ class: "foo" }, [["hello ", "world"]])).toBe(
      `<ul class="foo">hello world</ul>`
    );
    expect(i({ class: "fas fa-plus-square" })).toBe(
      '<i class="fas fa-plus-square"></i>'
    );
    expect(genericElement("div", { class: "foo" }, "Hello")).toBe(
      '<div class="foo">Hello</div>'
    );
  });

  it("class", () => {
    expect(div({ class: "foo" }, 5)).toBe('<div class="foo">5</div>');
    expect(div({ class: false }, 5)).toBe("<div>5</div>");
    expect(div({ class: "foo bar" }, 5)).toBe('<div class="foo bar">5</div>');
    expect(div({ class: ["foo", "bar"] }, 5)).toBe(
      '<div class="foo bar">5</div>'
    );
    expect(div({ class: ["foo", " "] }, 5)).toBe('<div class="foo  ">5</div>');
    expect(input({ class: ["foo", " "] })).toBe('<input class="foo  ">');

    expect(
      div({ class: ["foo bar", "", undefined, null, false, "baz"] }, 5)
    ).toBe('<div class="foo bar baz">5</div>');

    expect(div({ class: [undefined, null, false] }, 5)).toBe("<div>5</div>");
    expect(hr({ class: "foo" })).toBe('<hr class="foo">');
  });
  it("style", () => {
    expect(div({ style: "color:red;border:1px solid black" }, 5)).toBe(
      '<div style="color:red;border:1px solid black">5</div>'
    );
    expect(div({ style: ["color:red", "border:1px solid black"] }, 5)).toBe(
      '<div style="color:red;border:1px solid black">5</div>'
    );
    expect(
      div(
        { style: ["color:red", false, undefined, "border:1px solid black"] },
        5
      )
    ).toBe('<div style="color:red;border:1px solid black">5</div>');
    expect(div({ style: { color: "red", border: "1px solid black" } }, 5)).toBe(
      '<div style="color:red;border:1px solid black">5</div>'
    );

    expect(
      div({ style: { marginRight: "1px", border: "1px solid black" } }, 5)
    ).toBe('<div style="margin-right:1px;border:1px solid black">5</div>');
    //border-top-left-radius
    expect(
      div({ style: { marginRight: "1px", borderTopLeftRadius: "3px" } }, 5)
    ).toBe('<div style="margin-right:1px;border-top-left-radius:3px">5</div>');
    expect(hr({ style: { color: "red" } }, 5)).toBe('<hr style="color:red">');
    expect(hr({ style: {} })).toBe("<hr>");
    expect(hr({ style: null })).toBe("<hr>");
    expect(div({ class: "foo", style: null })).toBe('<div class="foo"></div>');
  });

  it("escaping", () => {
    expect(text("foo")).toBe("foo");
    expect(text_attr('" onMouseOver="alert(1);')).toBe(
      "&quot; onMouseOver=&quot;alert(1);"
    );
    expect(text(1)).toBe("1");
    expect(text(0)).toBe("0");
    expect(text("<script>alert(1);<script>")).toBe(
      "&lt;script&gt;alert(1);&lt;script&gt;"
    );
    expect(text("<p>alert<p>")).toBe("<p>alert<p>");
    expect(text("<kbd>ctrl<kbd>")).toBe("<kbd>ctrl<kbd>");
    expect(text('<span style="color:#2ecc71;">green</span>')).toBe(
      '<span style="color:#2ecc71;">green</span>'
    );
    expect(text('<article style="color:#2ecc71;">green</article>')).toBe(
      "<article>green</article>"
    );
    expect(
      text('<article style="color:#2ecc71;">green</article>', {
        article: ["style"],
      })
    ).toBe('<article style="color:#2ecc71;">green</article>');
    expect(
      text('<progress onclick="foo()">green</progress>', {
        progress: ["onclick"],
      })
    ).toBe('<progress onclick="foo()">green</progress>');
  });
});

describe("mjml tags", () => {
  it("renders", () => {
    expect(
      mjml.mjml(
        mjml.body(
          mjml.section(
            { "background-color": "#f0f0f0" },
            mjml.text("hello world")
          )
        )
      )
    ).toBe(
      '<mjml><mj-body><mj-section background-color="#f0f0f0"><mj-text>hello world</mj-text></mj-section></mj-body></mjml>'
    );
  });

  it("renders emailButton with default style", () => {
    const result = mjml.emailButton(
      {
        href: "https://example.com",
        title: "Click Me",
      },
      "Click Me"
    );

    const expected = `
  <a rel="noopener" target="_blank" title="Click Me" href="https://example.com" style="background-color: #6c757d; color: #ffffff; font-size: 18px; font-family: Helvetica, Arial, sans-serif; font-weight: bold; text-decoration: none; padding: 14px 20px; border-radius: 5px; display: inline-block; mso-padding-alt: 0;">
    <!--[if mso]>
    <i style="letter-spacing: 25px; mso-font-width: -100%; mso-text-raise: 30pt;">&nbsp;</i>
    <![endif]-->
    <span style="mso-text-raise: 15pt;">Click Me</span>
    <!--[if mso]>
    <i style="letter-spacing: 25px; mso-font-width: -100%;">&nbsp;</i>
    <![endif]-->
  </a>
`
      .replace(/\s+/g, " ")
      .trim();

    expect(result.replace(/\s+/g, " ").trim()).toBe(expected);
  });

  it("renders emailButton with btn-primary style", () => {
    const result = mjml.emailButton(
      {
        href: "https://example.com",
        title: "Click Me",
        btnStyle: "btn-primary",
      },
      "Click Me"
    );
    const expected =
      '<a rel="noopener" target="_blank" title="Click Me" href="https://example.com" style="background-color: #0d6efd; color: #ffffff; font-size: 18px; font-family: Helvetica, Arial, sans-serif; font-weight: bold; text-decoration: none; padding: 14px 20px; border-radius: 5px; display: inline-block; mso-padding-alt: 0;"> <!--[if mso]> <i style="letter-spacing: 25px; mso-font-width: -100%; mso-text-raise: 30pt;">&nbsp;</i> <![endif]--> <span style="mso-text-raise: 15pt;">Click Me</span> <!--[if mso]> <i style="letter-spacing: 25px; mso-font-width: -100%;">&nbsp;</i> <![endif]--> </a>'
        .replace(/\s+/g, " ")
        .trim();
    expect(result.replace(/\s+/g, " ").trim()).toBe(expected);
  });

  it("renders emailButton with btn-outline-primary style", () => {
    const result = mjml.emailButton(
      { href: "https://example.com", btnStyle: "btn-outline-primary" },
      "Click Me"
    );
    const expected =
      '<a rel="noopener" target="_blank" href="https://example.com" style="background-color: transparent; color: #0d6efd; border-color: #0d6efd;border-width:1px; border-style: solid; font-size: 18px; font-family: Helvetica, Arial, sans-serif; font-weight: bold; text-decoration: none; padding: 14px 20px; border-radius: 5px; display: inline-block; mso-padding-alt: 0;"> <!--[if mso]> <i style="letter-spacing: 25px; mso-font-width: -100%; mso-text-raise: 30pt;">&nbsp;</i> <![endif]--> <span style="mso-text-raise: 15pt;">Click Me</span> <!--[if mso]> <i style="letter-spacing: 25px; mso-font-width: -100%;">&nbsp;</i> <![endif]--> </a>'
        .replace(/\s+/g, " ")
        .trim();
    expect(result.replace(/\s+/g, " ").trim()).toBe(expected);
  });

  it("renders emailButton with custom title and style", () => {
    const result = mjml.emailButton(
      {
        href: "https://example.com",
        title: "Custom Title",
        btnStyle: "btn-danger",
        style: "color: #fff; background-color: #000",
      },
      "Click Me"
    );
    const expected =
      '<a rel="noopener" target="_blank" title="Custom Title" href="https://example.com" style="color: #fff; background-color: #000; border-width: 1px; border-style: solid; font-size: 18px; font-family: Helvetica, Arial, sans-serif; font-weight: bold; text-decoration: none; padding: 14px 20px; border-radius: 5px; display: inline-block; mso-padding-alt: 0;"> <!--[if mso]> <i style="letter-spacing: 25px; mso-font-width: -100%; mso-text-raise: 30pt;">&nbsp;</i> <![endif]--> <span style="mso-text-raise: 15pt;">Click Me</span> <!--[if mso]> <i style="letter-spacing: 25px; mso-font-width: -100%;">&nbsp;</i> <![endif]--> </a>'
        .replace(/\s+/g, " ")
        .trim();
    expect(result.replace(/\s+/g, " ").trim()).toBe(expected);
  });
});

describe("tabs", () => {
  it("renders tabs with single content", () => {
    const result = tabs({
      Tab1: "Content1",
    });
    expect(result).toBe(
      `<ul class="nav nav-tabs" role="tablist"><li class="nav-item"><a class="nav-link active" data-bs-toggle="tab" href="#Tab1" id="Tab1-tab" role="tab" aria-controls="home" aria-selected="true">Tab1</a></li></ul><div class="tab-content"><div class="tab-pane fade show active" id="Tab1" role="tabpanel" aria-labelledby="Tab1-tab">Content1</div></div>`
    );
  });

  it("renders tabs with multiple contents", () => {
    const result = tabs({ Tab1: "Content1", Tab2: "Content2" });
    expect(result).toBe(
      `<ul class="nav nav-tabs" role="tablist"><li class="nav-item"><a class="nav-link active" data-bs-toggle="tab" href="#Tab1" id="Tab1-tab" role="tab" aria-controls="home" aria-selected="true">Tab1</a></li><li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#Tab2" id="Tab2-tab" role="tab" aria-controls="home" aria-selected="true">Tab2</a></li></ul><div class="tab-content"><div class="tab-pane fade show active" id="Tab1" role="tabpanel" aria-labelledby="Tab1-tab">Content1</div><div class="tab-pane fade" id="Tab2" role="tabpanel" aria-labelledby="Tab2-tab">Content2</div></div>`
    );
  });

  it("renders tabs from an array of entries", () => {
    const result = tabs([
      ["Tab1", "Content1"],
      ["Tab2", "Content2"],
    ]);
    expect(result).toBe(
      `<ul class="nav nav-tabs" role="tablist"><li class="nav-item"><a class="nav-link active" data-bs-toggle="tab" href="#Tab1" id="Tab1-tab" role="tab" aria-controls="home" aria-selected="true">Tab1</a></li><li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#Tab2" id="Tab2-tab" role="tab" aria-controls="home" aria-selected="true">Tab2</a></li></ul><div class="tab-content"><div class="tab-pane fade show active" id="Tab1" role="tabpanel" aria-labelledby="Tab1-tab">Content1</div><div class="tab-pane fade" id="Tab2" role="tabpanel" aria-labelledby="Tab2-tab">Content2</div></div>`
    );
  });
  it("handles empty tabs gracefully", () => {
    const result = tabs({});
    expect(result).toBe(
      `<ul class="nav nav-tabs" role="tablist"></ul><div class="tab-content"></div>`
    );
  });
});

describe("table", () => {
  it("renders a basic table", () => {
    const headers = [
      { label: "Name", key: "name" },
      { label: "Age", key: "age" },
    ];
    const rows = [
      { name: "UserName1", age: 25, id: 1 },
      { name: "UserName2", age: 30, id: 2 },
    ];
    const result = mkTable(headers, rows);
    expect(result).toBe(
      `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr data-row-id="1"><td>UserName1</td><td>25</td></tr><tr data-row-id="2"><td>UserName2</td><td>30</td></tr></tbody></table></div>`
    );
  });

  it("renders a tramnsposed table", () => {
    const headers = [
      {
        label: "Name",
        key: "name",
      },
      {
        label: "Age",
        key: "age",
      },
    ];
    const rows = [
      { name: "UserName1", age: 25 },
      { name: "UserName2", age: 30 },
    ];
    const result = mkTable(headers, rows, { transpose: true });
    expect(result).toBe(
      `<div class="table-responsive"><table class="table table-sm"><tbody><tr row-key="name"><th>Name</th><td>UserName1</td><td>UserName2</td></tr><tr row-key="age"><th>Age</th><td>25</td><td>30</td></tr></tbody></table></div>`
    );
  });

  it("renders a transposed table", () => {
    const headers = [
      {
        label: "Name",
        key: "name",
      },
      {
        label: "Age",
        key: "age",
      },
    ];
    const rows = [
      { name: "UserName1", age: 25 },
      { name: "UserName2", age: 30 },
    ];

    const result = mkTable(headers, rows, { transpose: true });
    expect(result).toBe(
      `<div class="table-responsive"><table class="table table-sm"><tbody><tr row-key="name"><th>Name</th><td>UserName1</td><td>UserName2</td></tr><tr row-key="age"><th>Age</th><td>25</td><td>30</td></tr></tbody></table></div>`
    );
  });

  it("renders a table with pagination", () => {
    const headers = [
      { label: "Name", key: "name" },
      { label: "Age", key: "age" },
    ];
    const rows = [
      { name: "UserName1", age: 25, id: 1 },
      { name: "UserName2", age: 30, id: 2 },
    ];
    const paginationOpts = {
      current_page: 1,
      pages: 3,
      get_page_link: (page: number) => `?page=${page}`,
    };
    const result = mkTable(headers, rows, { pagination: paginationOpts });
    expect(result).toBe(
      `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr data-row-id="1"><td>UserName1</td><td>25</td></tr><tr data-row-id="2"><td>UserName2</td><td>30</td></tr></tbody></table><ul class="pagination"><li class="page-item active"><span class="page-link link-style" onclick="?page=1" role="link">1</span></li><li class="page-item"><span class="page-link link-style" onclick="?page=2" role="link">2</span></li><li class="page-item"><span class="page-link link-style" onclick="?page=3" role="link">3</span></li></ul></div>`
    );
  });
});

describe("mjml-layout", () => {
  describe("transformTextStyle", () => {
    it("transforms text styles correctly", () => {
      expect(transformTextStyle("h1")).toEqual({
        "font-size": "2em",
        "margin-top": "0.67em",
        "margin-bottom": "0.67em",
        "margin-left": 0,
        "margin-right": 0,
        "font-weight": "bold",
      });
      expect(transformTextStyle("fw-bold")).toEqual({
        "font-weight": "700 !important",
      });
      expect(transformTextStyle("text-muted")).toEqual({
        "--bs-text-opacity": "1",
        color: "#858796 !important",
      });
    });

    it("returns an empty object for unknown styles", () => {
      expect(transformTextStyle("unknown-style")).toEqual({});
    });
  });

  describe("transformLinkSize", () => {
    it("transforms link sizes correctly", () => {
      expect(transformLinkSize("btn-lg")).toEqual({
        padding: "0.5rem 1rem",
        "font-size": "1.25rem",
      });
      expect(transformLinkSize("btn-sm")).toEqual({
        padding: "0.25rem 0.5rem",
        "font-size": "0.875rem",
      });
    });
    it("returns an empty object for unknown sizes", () => {
      expect(transformLinkSize("unkown-size")).toEqual({});
    });
  });

  describe("applyTextStyle", () => {
    it("applies text style to block elements", () => {
      const segment = {
        textStyle: "h1",
        inline: false,
        style: {
          color: "red",
        },
      };
      const inner = "Hello World";
      const result = applyTextStyle(segment, inner);
      expect(result).toContain('<div style="');
      expect(result).toContain("font-size:2em");
      expect(result).toContain("color:red");
    });

    it("applies text styles to inline elements", () => {
      const segment = {
        textStyle: "fw-bold",
        inline: true,
        style: { color: "blue" },
      };
      const inner = "Hello World";
      const result = applyTextStyle(segment, inner);
      expect(result).toContain('<span style="');
      expect(result).toContain("font-weight:700 !important");
      expect(result).toContain("color:blue");
      expect(result).toContain("Hello World");
    });

    it("returns inner content without wrapping if no styles are applied", () => {
      const segment = { textStyle: null, style: {} };
      const inner = "Hello World";
      const result = applyTextStyle(segment, inner);
      expect(result).toBe("Hello World");
    });
  });

  describe("renderMJML", () => {
    it("renders a layout with an image", () => {
      const layout = {
        type: "container",
        contents: [
          {
            type: "image",
            alt: "Test Image",
            fileid: 1,
            srcType: "File",
            style: {
              width: "100%",
            },
          },
        ],
      };
      const req = {
        isSubView: false,
        get_base_url: () => "https://example.com",
      };
      const result = renderMJML({
        layout,
        req,
      });
      expect(result.markup).toBe(
        `<mj-section><mj-raw><div style="text-align: left !important; font-size: 16px;"><img style="width:100%" alt="Test Image" src="https://example.com/files/serve/1"></div></mj-raw></mj-section>`
      );
    });

    it("renders a layout with a link", () => {
      const layout = {
        type: "container",
        contents: [
          {
            type: "link",
            url: "https://example.com",
            text: "Click Here",
            link_style: "btn btn-primary",
          },
        ],
      };
      const result = renderMJML({ layout, req: { isSubView: false } });
      const expected =
        `<mj-section><mj-raw><div style="text-align: left !important; font-size: 16px;"><a rel="noopener" target="_blank" href="https://example.com" style="background-color: #0d6efd; color: #ffffff; font-size: 18px; font-family: Helvetica, Arial, sans-serif; font-weight: bold; text-decoration: none; padding: 14px 20px; border-radius: 5px; display: inline-block; mso-padding-alt: 0;">
        <!--[if mso]>
        <i style="letter-spacing: 25px; mso-font-width: -100%; mso-text-raise: 30pt;">&nbsp;</i>
        <![endif]-->
        <span style="mso-text-raise: 15pt;">Click Here</span>
        <!--[if mso]>
        <i style="letter-spacing: 25px; mso-font-width: -100%;">&nbsp;</i>
        <![endif]-->
    </a></div></mj-raw></mj-section>`
          .replace(/\s+/g, " ")
          .trim();
      expect(result.markup.replace(/\s+/g, " ").trim()).toBe(expected);
    });

    it("renders a layout with nested containers", () => {
      const layout = {
        type: "container",
        contents: [
          {
            type: "container",
            contents: [
              {
                type: "blank",
                contents: "Nested Text",
                bgColor: "#f0f0f0",
              },
            ],
          },
        ],
      };
      const result = renderMJML({
        layout,
        req: { isSubView: false },
      });
      const expected =
        `<mj-section><mj-raw><div style="text-align: left !important; font-size: 16px;"><div style=" border: 0px none black;">Nested Text</div></div></mj-raw></mj-section>`
          .replace(/\s+/g, " ")
          .trim();
      const recieved = result.markup.replace(/\s+/g, " ").trim();
      expect(recieved).toBe(expected);
    });

    it("renders a layout with a card", () => {
      const layout = {
        type: "container",
        contents: [
          {
            type: "card",
            title: "Card Title",
            contents: { type: "blank", contents: "Card Content" },
          },
        ],
      };
      const result = renderMJML({
        layout,
        req: { isSubView: false },
      });
      const expected =
        `<mj-section><mj-raw><div style="text-align: left !important; font-size: 16px;"><div class="card mt-4 shadow"><div class="card-header"><h6 class="m-0 fw-bold text-primary">Card Title</h6></div><div class="card-body">Card Content</div></div></div></mj-raw></mj-section>`
          .replace(/\s+/g, " ")
          .trim();
      const recieved = result.markup.replace(/\s+/g, " ").trim();
      expect(recieved).toBe(expected);
    });

    it("renders a layout with tabs", () => {
      const layout = {
        type: "tabs",
        contents: [
          {
            type: "tabs",
            tabs: {
              Tab1: "Content1",
              Tab2: "Content2",
            },
          },
        ],
      };
      const result = renderMJML({
        layout,
        req: { isSubView: false },
      });
      const expected =
        `<mj-section><mj-raw><div style="text-align: left !important; font-size: 16px;"></div></mj-raw></mj-section>`
          .replace(/\s+/g, " ")
          .trim();
      const recieved = result.markup.replace(/\s+/g, " ").trim();
      expect(recieved).toBe(expected);
    });
  });

  it("renders a layout with a page header", () => {
    const layout = {
      type: "container",
      contents: [
        {
          type: "pageHeader",
          title: "Welcome",
          blurb: "This is a test page header",
        },
      ],
    };
    const result = renderMJML({ layout, req: { isSubView: false } });
    expect(result.markup).toBe(
      `<mj-section><mj-raw><div style="text-align: left !important; font-size: 16px;"><h1>Welcome</h1><p>This is a test page header</p></div></mj-raw></mj-section>`
    );
  });

  it("renders layout with a table", () => {
    const layout = {
      type: "container",
      contents: [
        {
          type: "table",
          rows: 2,
          columns: 2,
          contents: [
            [
              { type: "blank", contents: "Cell 1" },
              { type: "blank", contents: "Cell 2" },
            ],
            [
              { type: "blank", contents: "Cell 3" },
              { type: "blank", contents: "Cell 4" },
            ],
          ],
        },
      ],
    };
    const result = renderMJML({
      layout,
      req: { isSubView: false },
    });
    expect(result.markup).toBe(
      `<mj-section><mj-raw><div style="text-align: left !important; font-size: 16px;"><table><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr><tr><td>Cell 3</td><td>Cell 4</td></tr></tbody></table></div></mj-raw></mj-section>`
    );
  });

  it("renders a layout with a dropdown menu", () => {
    const layout = {
      type: "container",
      contents: [
        {
          type: "dropdown_menu",
          items: [
            {
              type: "Option 1",
              url: "/option1",
            },
            {
              type: "Option 2",
              url: "/option2",
            },
          ],
        },
      ],
    };
    const result = renderMJML({ layout, req: { isSubView: false } });
    expect(result.markup).toBe(
      `<mj-section><mj-raw><div style="text-align: left !important; font-size: 16px;"></div></mj-raw></mj-section>`
    );
  });

  it("renders a layout with conditional visibility based on role", () => {
    const layout = {
      type: "container",
      contents: [
        {
          type: "blank",
          contents: "Visible to all",
        },
        {
          type: "blank",
          contents: "Visible to admins only",
          minRole: 1,
        },
      ],
    };
    const resultForAdmin = renderMJML({
      layout,
      req: { isSubView: false },
      role: 1,
    });
    const resultForUser = renderMJML({
      layout,
      req: { isSubView: false },
      role: 2,
    });

    expect(resultForAdmin.markup).toContain(
      `<mj-section><mj-raw><div style="text-align: left !important; font-size: 16px;">Visible to allVisible to admins only</div></mj-raw></mj-section>`
    );
    expect(resultForUser.markup).toContain(
      `<mj-section><mj-raw><div style="text-align: left !important; font-size: 16px;">Visible to all</div></mj-raw></mj-section>`
    );
  });

  it("renders a layout with a gradient background", () => {
    const layout = {
      type: "container",
      bgType: "Gradient",
      gradStartColor: "#ff0000",
      gradEndColor: "#0000ff",
      gradDirection: 45,
      contents: [{ type: "blank", contents: "Gradient Background" }],
    };
    const result = renderMJML({ layout, req: { isSubView: false } });
    expect(result.markup).toBe(
      `<mj-section><mj-raw><div style="text-align: left !important; font-size: 16px;">Gradient Background</div></mj-raw></mj-section>`
    );
  });

  it("renders a layout with a rotated container", () => {
    const layout = {
      type: "container",
      rotate: 45,
      contents: [{ type: "blank", contents: "Rotated Content" }],
    };
    const result = renderMJML({ layout, req: { isSubView: false } });
    expect(result.markup).toBe(
      `<mj-section><mj-raw><div style="text-align: left !important; font-size: 16px;">Rotated Content</div></mj-raw></mj-section>`
    );
  });

  it("renders a layout with a custom class and CSS", () => {
    const layout = {
      type: "container",
      customClass: "custom-container",
      customCSS: "border: 1px solid red;",
      contents: [{ type: "blank", contents: "Custom Styled Content" }],
    };
    const result = renderMJML({ layout, req: { isSubView: false } });
    expect(result.markup).toBe(
      `<mj-section><mj-raw><div style="text-align: left !important; font-size: 16px;">Custom Styled Content</div></mj-raw></mj-section>`
    );
  });
});

describe("index", () => {
  describe("post-bn", () => {
    it("renders a basic post button", () => {
      const result = post_btn("/submit", "Submit", "csrfToken123", {
        btnClass: "btn-primary",
      });

      expect(result).toContain('<form action="/submit" method="post">');
      expect(result).toContain(
        '<input type="hidden" name="_csrf" value="csrfToken123">'
      );
      expect(result).toContain(
        '<button type="submit" class=" btn  btn-primary d-inline-block">Submit</button>'
      );
      expect(result).toContain("</form>");
    });

    it("renders a basic post button", () => {
      const result = post_btn("/submit", "Submit", "csrfToken123", {
        btnClass: "btn-primary",
      });

      expect(result).toContain('<form action="/submit" method="post">');
      expect(result).toContain(
        '<input type="hidden" name="_csrf" value="csrfToken123">'
      );
      expect(result).toContain(
        '<button type="submit" class=" btn  btn-primary d-inline-block">Submit</button>'
      );
      expect(result).toContain("</form>");
    });
  });

  describe("post_delete_btn", () => {
    it("renders a delete button with confirmation", () => {
      const req = {
        csrfToken: () => "csrfToken123",
        __: (str: string) => str,
        "Are you sure?": "Are you sure?",
      };
      const result = post_delete_btn("/delete", req);
      const normalized = result.replace(/\s+/g, " ").trim();

      expect(normalized).toBe(
        `<form action=\"/delete\" method=\"post\"><input type=\"hidden\" name=\"_csrf\" value=\"csrfToken123\"><button type=\"submit\" class=\"btn btn-danger btn-sm\" onclick=\"return confirm('Are you sure?')\"><i class=\"fas fa-trash-alt\"></i></button></form>`
          .replace(/\s+/g, " ")
          .trim()
      );
    });
  });

  describe("post_dropdown_item", () => {
    it("renders a dropdown item with confirmation", () => {
      const req = {
        csrfToken: () => "csrfToken123",
        __: (str: string) => str,
        "Are you sure?": "Are you sure?",
      };
      const result = post_dropdown_item("/delete", "Delete", req, true);
      expect(result).toContain('<a class="dropdown-item"');
      expect(result).toContain("onclick=\"if(confirm('Are you sure?'))");
      expect(result).toContain("$('#delete').submit()\">Delete</a>");
      expect(result).toContain(
        '<form id="delete" action="/delete" method="post">'
      );
      expect(result).toContain(
        '<input type="hidden" name="_csrf" value="csrfToken123">'
      );
    });
  });

  describe("settingsDropdown", () => {
    it("renders a settings dropdown", () => {
      const result = settingsDropdown("dropdown1", "<a>Option 1</a>");
      expect(result).toContain('<div class="dropdown">');
      expect(result).toContain(
        '<button class="btn btn-sm btn-outline-secondary"'
      );
      expect(result).toContain('<div class="dropdown-menu dropdown-menu-end"');
      expect(result).toContain("<a>Option 1</a>");
    });
  });

  describe("localeDate", () => {
    it("renders a localized date", () => {
      const date = new Date("2023-01-01T00:00:00Z");
      const result = localeDate(date, {}, "en");
      expect(result).toContain('<time datetime="2023-01-01T00:00:00.000Z"');
      expect(result).toContain(">1/1/2023</time>");
    });

    it("renders a localized date with custom options", () => {
      const date = new Date("2023-01-01T00:00:00Z");
      const result = localeDate(
        date,
        { year: "numeric", month: "long", day: "numeric" },
        "en"
      );
      expect(result).toContain('<time datetime="2023-01-01T00:00:00.000Z"');
      expect(result).toContain(">January 1, 2023</time>");
    });
  });
});

describe("builder", () => {
  it("renders the builder with default options", () => {
    const options = { someOption: "value" };
    const context = { someContent: "value" };
    const action = "/submit";
    const stepName = "step1";
    const layout = { type: "container", contents: [] };
    const csrfToken = "csrfToken123";

    const result = builder(
      { options, context, action, stepName, layout },
      csrfToken
    );
    expect(result).toContain('<div id="saltcorn-builder"></div>');
    expect(result).toContain(
      '<form action="/submit" method="post" id="scbuildform">'
    );
    expect(result).toContain('<input type="hidden" name="contextEnc"');
    expect(result).toContain(
      '<input type="hidden" name="stepName" value="step1">'
    );
    expect(result).toContain(
      '<input type="hidden" name="_csrf" value="csrfToken123"'
    );
    expect(result).toContain("builder.renderBuilder(");
  });

  it("renders the builder with a version tag", () => {
    const options = { someOptions: "value" };
    const context = { someContext: "value" };
    const action = "/submit";
    const stepName = "step1";
    const layout = { type: "container", contents: [] };
    const csrfToken = "csrfToken123";
    const version_tag = "v1.0.0";

    const result = builder(
      { options, context, action, stepName, layout, version_tag },
      csrfToken
    );
    expect(result).toContain(
      '<script src="/static_assets/v1.0.0/builder_bundle.js"></script>'
    );
    expect(result).toContain(
      '<link rel="stylesheet" type="text/css" media="screen" href="/static_assets/v1.0.0/saltcorn-builder.css">'
    );
  });

  it("renders the builder with custom mode", () => {
    const options = { someOption: "value" };
    const context = { someOptions: "value" };
    const action = "/submit";
    const stepName = "step1";
    const layout = { type: "container", contents: [] };
    const csrfToken = "csrfToken123";
    const mode = "edit";

    const result = builder(
      { options, context, action, stepName, layout, mode },
      csrfToken
    );
    expect(result).toContain("builder.renderBuilder(");
    expect(result).toContain('"edit"');
  });
});
