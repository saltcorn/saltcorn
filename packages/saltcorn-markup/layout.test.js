const render = require("./layout");
const { p } = require("./tags");

describe("layout", () => {
  it("renders a simple layout", () => {
    const blockDispatch = {
      wrapTop(segment, ix, s) {
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
    expect(render({ blockDispatch, layout: markup })).toBe("<p>raboof</p>");
  });
});
