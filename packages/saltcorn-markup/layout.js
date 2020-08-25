const { contract, is } = require("contractis");
const { div, a, span, h6, text, img } = require("./tags");
const { alert, breadcrumbs } = require("./layout_utils");
const { search_bar_form } = require("./helpers");

const makeSegments = (body, alerts) => {
  const alertsSegments =
    alerts && alerts.length > 0
      ? [{ type: "blank", contents: alerts.map(a => alert(a.type, a.msg)) }]
      : [];
  if (typeof body === "string")
    return {
      above: [...alertsSegments, { type: "blank", contents: body }]
    };
  else if (body.above) {
    if (alerts && alerts.length > 0) body.above.unshift(alertsSegments[0]);
    return body;
  } else {
    if (alerts && alerts.length > 0)
      return { above: [...alertsSegments, body] };
    else return body;
  }
};

const render = ({ blockDispatch, layout, role, alerts }) => {
  //console.log(JSON.stringify(layout, null, 2));
  function wrap(segment, isTop, ix, inner) {
    if (isTop && blockDispatch && blockDispatch.wrapTop)
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
    if (
      typeof segment === "object" &&
      Object.keys(segment).length === 0 &&
      segment.constructor === Object
    )
      return "";
    if (typeof segment === "string") return wrap(segment, isTop, ix, segment);
    if (Array.isArray(segment))
      return wrap(
        segment,
        isTop,
        ix,
        segment.map((s, jx) => go(s, isTop, jx + ix)).join("")
      );
    if (segment.minRole && role > segment.minRole) return "";
    if (segment.type && blockDispatch && blockDispatch[segment.type]) {
      return wrap(segment, isTop, ix, blockDispatch[segment.type](segment, go));
    }
    if (segment.type === "blank") {
      return wrap(segment, isTop, ix, segment.contents || "");
    }
    if (segment.type === "breadcrumbs") {
      return wrap(segment, isTop, ix, breadcrumbs(segment.crumbs || []));
    }
    if (segment.type === "view") {
      return wrap(segment, isTop, ix, segment.contents || "");
    }
    if (segment.type === "image") {
      return wrap(
        segment,
        isTop,
        ix,
        img({
          class: "w-100",
          alt: segment.alt,
          src: `/files/serve/${segment.fileid}`
        })
      );
    }
    if (segment.type === "link") {
      return wrap(segment, isTop, ix, a({ href: segment.url }, segment.text));
    }
    if (segment.type === "card")
      return wrap(
        segment,
        isTop,
        ix,
        div(
          { class: "card shadow mt-4" },
          segment.title &&
            div(
              { class: "card-header py-3" },
              h6(
                { class: "m-0 font-weight-bold text-primary" },
                text(segment.title)
              )
            ),
          div({ class: "card-body" }, go(segment.contents))
        )
      );
    if (segment.type === "container") {
      const {
        bgFileId,
        bgType,
        bgColor,
        vAlign,
        hAlign,
        imageSize,
        minHeight,
        borderWidth,
        borderStyle,
        setTextColor,
        textColor
      } = segment;
      const renderBg = !(
        isTop &&
        blockDispatch.noBackgroundAtTop &&
        blockDispatch.noBackgroundAtTop()
      );
      return wrap(
        segment,
        isTop,
        ix,
        div(
          {
            class: [
              `text-${hAlign}`,
              vAlign === "middle" && "d-flex align-items-center",
              vAlign === "middle" &&
                hAlign === "center" &&
                "justify-content-center"
            ],
            style: `min-height: ${minHeight || 0}px; 
          border: ${borderWidth || 0}px ${borderStyle} black; 
          ${
            renderBg && bgType === "Image" && bgFileId && +bgFileId
              ? `background-image: url('/files/serve/${bgFileId}');
          background-size: ${imageSize || "contain"};
          background-repeat: no-repeat;`
              : ""
          }
          ${
            renderBg && bgType === "Color"
              ? `background-color: ${bgColor};`
              : ""
          }
          ${setTextColor ? `color: ${textColor};` : ""}`
          },
          go(segment.contents)
        )
      );
    }

    if (segment.type === "line_break") {
      return "<br />";
    }
    if (segment.type === "search_bar") {
      return search_bar_form();
    }
    if (segment.above) {
      return segment.above.map((s, ix) => go(s, isTop, ix)).join("");
    } else if (segment.besides) {
      const defwidth = Math.round(12 / segment.besides.length);
      const markup = div(
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
      return isTop ? wrap(segment, isTop, ix, markup) : markup;
    } else throw new Error("unknown layout segment" + JSON.stringify(segment));
  }
  return go(makeSegments(layout, alerts), true, 0);
};

const is_segment = is.obj({ type: is.maybe(is.str) });

module.exports = contract(
  is.fun(
    is.obj({
      blockDispatch: is.maybe(is.objVals(is.fun(is_segment, is.str))),
      layout: is.or(is_segment, is.str),
      role: is.maybe(is.posint),
      alerts: is.maybe(
        is.array(is.obj({ type: is.str, msg: is.or(is.str, is.array(is.str)) }))
      )
    }),
    is.str
  ),
  render
);
