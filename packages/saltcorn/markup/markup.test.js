const { a, input, div } = require("./tags");

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
    expect(div()).toBe("<div />");
    expect(div(["hello ", "world"])).toBe("<div>hello world</div>");
    expect(Array.isArray(["hello ", "world"])).toBe(true);
    expect(Array.isArray({})).toBe(false);
  });
});
