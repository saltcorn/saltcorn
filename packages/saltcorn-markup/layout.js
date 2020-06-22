const { contract, is } = require("contractis");
const { div, span } = require("./tags");

const render = blockDispatch => (layout, role) => {
  //console.log(layout);
  function wrap(segment, isTop, ix, inner) {
    if (isTop && blockDispatch.wrapTop)
      return blockDispatch.wrapTop(segment, ix, inner);
    else
      return segment.block
        ? div({ class: segment.textStyle || "" }, inner)
        : span({ class: segment.textStyle || "" }, inner);
  }
  function go(segment, isTop, ix) {
    if (!segment) return "";
    if (segment.minRole && role > segment.minRole) return "";
    if (segment.type && blockDispatch[segment.type]) {
      return wrap(segment, isTop, ix, blockDispatch[segment.type](segment));
    }
    if (segment.type === "blank") {
      return wrap(segment, isTop, ix, segment.contents);
    }
    if (segment.type === "line_break") {
      return "<br />";
    }
    if (segment.above) {
      return segment.above.map((s, ix) => go(s, isTop, ix)).join("");
    } else if (segment.besides) {
      const defwidth = Math.round(12 / segment.besides.length);
      const markup= div(
        { class: "row" },
        segment.besides.map((t, ixb) =>
          div(
            {
              class: `col-sm-${
                segment.widths ? segment.widths[ixb] : defwidth
              } text-${segment.aligns ? segment.aligns[ixb] : ""}`
            },
            go(t, false, ixb)
          )
        )
      );
      return isTop? wrap(segment, isTop, ix, markup) : markup;
    } else throw new Error("unknown layout segment" + JSON.stringify(segment));
  }
  return go(layout, true, 0);
};

const is_segment = is.obj({ type: is.maybe(is.str) });

module.exports = contract(
  is.fun(
    is.objVals(is.fun(is_segment, is.str)),
    is.fun([is_segment, is.posint], is.str)
  ),
  render
);
