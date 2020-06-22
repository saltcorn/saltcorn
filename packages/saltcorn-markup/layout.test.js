const render = require("./layout");
const { p } = require("./tags");

describe("layout", () => {
  it("renders a simple layout", () => {
    const blocks = {
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
    expect(render(blocks)({ layout: markup })).toBe("<p>raboof</p>");
  });
});
