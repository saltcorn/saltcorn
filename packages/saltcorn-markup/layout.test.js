const render = require("./layout");

describe("layout", () => {
  it("renders a simple layout", () => {
    const blocks = {
      reverseIt({ theString }) {
        return theString
          .split("")
          .reverse()
          .join("");
      }
    };
    const markup = { above: [{ type: "reverseIt", theString: "foobar" }] };
    expect(render(blocks)(markup)).toBe("raboof");
  });
});
