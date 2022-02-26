import { describe, it, expect } from "@jest/globals";
import tags = require("./tags");
import mjml = require("./mjml-tags");
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
    expect(i()).toBe("<i></i>");
    expect(hr()).toBe("<hr>");
    expect(div(["hello ", "world"])).toBe("<div>hello world</div>");
    expect(ul({ class: "foo" }, [false, "hello ", "world"])).toBe(
      `<ul class="foo">hello world</ul>`
    );
    expect(ul({ class: "foo" }, [["hello ", "world"]])).toBe(
      `<ul class="foo">hello world</ul>`
    );
    expect(Array.isArray(["hello ", "world"])).toBe(true);
    expect(Array.isArray({})).toBe(false);
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
});
