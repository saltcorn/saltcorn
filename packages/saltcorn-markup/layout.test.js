const render = require("./layout");
const { p } = require("./tags");

describe("layout", () => {
  it("renders a simple layout", () => {
    const blocks = {
      wrapAll(s, segment) {
        return p(s);
      },
      reverseIt({ theString }) {
        return theString
          .split("")
          .reverse()
          .join("");
      }
    };
    const markup = { above: [{ type: "reverseIt", theString: "foobar" }] };
    expect(render(blocks)(markup)).toBe("<p>raboof</p>");
  });
});
