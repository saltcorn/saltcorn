const { a } = require("./tags");

describe("sqlsanitize", () => {
  it("renders", () => {
    expect(a({ href: "/" }, "Home")).toBe('<a href="/">Home</a>');
    expect(a({ href: "/" }, ["Home", " Sweet", " Home"])).toBe(
      '<a href="/">Home Sweet Home</a>'
    );
    expect(a({ href: "/", class: "centre" }, "Home")).toBe(
      '<a href="/" class="centre">Home</a>'
    );
  });
});
