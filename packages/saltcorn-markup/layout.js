const { contract, is } = require("contractis");
const { div, span, h6, text } = require("./tags");
const {
    alert
  } = require("./layout_utils");

const makeSegments = (body, alerts) => {
    const alertsSegments = alerts && alerts.length>0
      ? [{ type: "blank", contents: alerts.map(a => alert(a.type, a.msg)) }]
      : [];
    if (typeof body === "string")
      return {
        above: [...alertsSegments, { type: "blank", contents: body }]
      };
    else if (body.above) {
      if (alerts&& alerts.length>0) body.above.unshift(alertsSegments[0]);
      return body;
    } else {
      if (alerts&& alerts.length>0) return { above: [...alertsSegments, body] };
      else return body;
    }
  };

const render = blockDispatch => ({layout, role, alerts}) => {
  //console.log(JSON.stringify(layout, null, 2));
  function wrap(segment, isTop, ix, inner) {
    if (isTop && blockDispatch.wrapTop)
      return blockDispatch.wrapTop(segment, ix, inner);
    else
      return segment.block
        ? div({ class: segment.textStyle || "" }, inner)
        : segment.textStyle 
        ? span({ class: segment.textStyle || "" }, inner)
        : inner;
  }
  function go(segment, isTop, ix) {
    if (!segment) return "";
    if (typeof segment==="string") 
        return wrap(segment, isTop, ix, segment);
    if(Array.isArray(segment))
        return wrap(segment, isTop, ix, segment.map((s,jx)=> go(s, isTop, jx+ix)).join(''))
    if (segment.minRole && role > segment.minRole) return "";
    if (segment.type && blockDispatch[segment.type]) {
      return wrap(segment, isTop, ix, blockDispatch[segment.type](segment, go));
    }
    if (segment.type === "blank") {
      return wrap(segment, isTop, ix, segment.contents);
    }
    if (segment.type === "card") 
        return wrap(segment, isTop, ix, div(
            { class: "card shadow mt-4" },
            segment.title &&
              div(
                { class: "card-header py-3" },
                h6({ class: "m-0 font-weight-bold text-primary" }, text(segment.title))
              ),
            div(
              { class: "card-body" },
              go(segment.contents)
            )
          ));
    
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
  return go(makeSegments(layout, alerts), true, 0);
};

const is_segment = is.obj({ type: is.maybe(is.str) });

module.exports = contract(
  is.fun(
    is.objVals(is.fun(is_segment, is.str)),
    is.fun([is_segment, is.posint], is.str)
  ),
  render
);
