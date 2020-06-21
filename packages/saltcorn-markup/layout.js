const { contract, is } = require("contractis");
const { div, text } = require("./tags");

const render = blockDispatch => (layout, role) => {
  function wrap(segment, s) {
    if (blockDispatch.wrapall) return blockDispatch.wrapAll(s, segment);
    else return s;
  }
  function go(segment) {
    if (!segment) return "";
    if (segment.minRole && role > segment.minRole) return "";
    if (segment.type && blockDispatch[segment.type]) {
      return wrap(segment, blockDispatch[segment.type](segment));
    }
    if (segment.type === "blank") {
      return wrap(segment, segment.contents);
    }
    if (segment.type === "line_break") {
      return "<br />";
    }
    if (segment.above) {
      return segment.above.map(s => go(s)).join("");
    } else if (segment.besides) {
      const defwidth = Math.round(12 / segment.besides.length);
      return div(
        { class: "row" },
        segment.besides.map((t, ix) =>
          div(
            {
              class: `col-sm-${
                segment.widths ? segment.widths[ix] : defwidth
              } text-${segment.aligns ? segment.aligns[ix] : ""}`
            },
            go(t)
          )
        )
      );
    } else throw new Error("unknown layout segment" + JSON.stringify(segment));
  }
  return go(layout);
};

const is_segment = is.obj({ type: is.maybe(is.str) });

module.exports = contract(
  is.fun(
    is.objVals(is.fun(is_segment, is.str)),
    is.fun([is_segment, is.posint], is.str)
  ),
  render
);
