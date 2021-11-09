/**
 * @category saltcorn-markup
 * @module layout
 */

const { contract, is } = require("contractis");
const {
  div,
  a,
  span,
  text,
  img,
  p,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  label,
  ul,
  button,
  li,
  i,
  genericElement,
} = require("./tags");
const { alert, breadcrumbs } = require("./layout_utils");
const { search_bar_form, search_bar } = require("./helpers");

/**
 * @param {object[]} [alerts]
 * @returns {boolean}
 */
const couldHaveAlerts = (alerts) => alerts || Array.isArray(alerts);

/**
 * @param {string|object} body 
 * @param {object[]} [alerts]
 * @returns {object}
 */
const makeSegments = (body, alerts) => {
  const alertsSegments = couldHaveAlerts(alerts)
    ? [
        {
          type: "blank",
          contents: div(
            { id: "alerts-area" },
            (alerts || []).map((a) => alert(a.type, a.msg))
          ),
        },
      ]
    : [];

  if (typeof body === "string")
    return {
      above: [...alertsSegments, { type: "blank", contents: body }],
    };
  else if (body.above) {
    if (couldHaveAlerts(alerts)) body.above.unshift(alertsSegments[0]);
    return body;
  } else return { above: [...alertsSegments, body] };
};

/**
 * 
 * @param {object} segment 
 * @param {string} inner 
 * @returns {div|span|string}
 */
const applyTextStyle = (segment, inner) => {
  let style = segment.font ? { fontFamily: segment.font } : {};
  switch (segment.textStyle) {
    case "h1":
      return h1(style, inner);
    case "h2":
      return h2(style, inner);
    case "h3":
      return h3(style, inner);
    case "h4":
      return h4(style, inner);
    case "h5":
      return h5(style, inner);
    case "h6":
      return h6(style, inner);
    default:
      return segment.block
        ? div({ class: segment.textStyle || "", style }, inner)
        : segment.textStyle || segment.font
        ? span({ class: segment.textStyle || "", style }, inner)
        : inner;
  }
};

/**
 * @param {object} opts
 * @param {object[]} opts.contents
 * @param {string[]} opts.titles
 * @param {string} opts.tabsStyle
 * @param {*} opts.ntabs
 * @param {function} go 
 * @returns {ul_div}
 */
const renderTabs = ({ contents, titles, tabsStyle, ntabs }, go) => {
  const rndid = `tab${Math.floor(Math.random() * 16777215).toString(16)}`;
  if (tabsStyle === "Accordion")
    return div(
      { class: "accordion", id: `${rndid}top` },
      contents.map((t, ix) =>
        div(
          { class: "card" },
          div(
            { class: "card-header", id: `${rndid}head${ix}` },
            h2(
              { class: "mb-0" },
              button(
                {
                  class: "btn btn-link btn-block text-left",
                  type: "button",
                  "data-toggle": "collapse",
                  "data-target": `#${rndid}tab${ix}`,
                  "aria-expanded": ix === 0 ? "true" : "false",
                  "aria-controls": `${rndid}tab${ix}`,
                },
                titles[ix]
              )
            )
          ),
          div(
            {
              class: ["collapse", ix === 0 && "show"],
              id: `${rndid}tab${ix}`,
              "aria-labelledby": `${rndid}head${ix}`,
              "data-parent": `#${rndid}top`,
            },
            div({ class: "card-body" }, go(t, false, ix))
          )
        )
      )
    );
  else
    return (
      ul(
        {
          role: "tablist",
          id: `${rndid}`,
          class: `nav ${tabsStyle === "Tabs" ? "nav-tabs" : "nav-pills"}`,
        },
        contents.map((t, ix) =>
          li(
            { class: "nav-item", role: "presentation" },
            a(
              {
                class: ["nav-link", ix === 0 && "active"],
                id: `${rndid}link${ix}`,
                "data-toggle": "tab",
                href: `#${rndid}tab${ix}`,
                role: "tab",
                "aria-controls": `${rndid}tab${ix}`,
                "aria-selected": ix === 0 ? "true" : "false",
              },
              titles[ix]
            )
          )
        )
      ) +
      div(
        { class: "tab-content", id: `${rndid}content` },
        contents.map((t, ix) =>
          div(
            {
              class: ["tab-pane fade", ix === 0 && "show active"],
              role: "tabpanel",
              id: `${rndid}tab${ix}`,
              "aria-labelledby": `${rndid}link${ix}`,
            },
            go(t, false, ix)
          )
        )
      )
    );
};

/**
 * @param {object} opts
 * @param {object} opts.blockDispatch
 * @param {object|string} opts.layout
 * @param {object} [opts.role]
 * @param {object[]} [opts.alerts]
 * @param {boolean} opts.is_owner missing in contract
 * @returns {string}
 */
const render = ({ blockDispatch, layout, role, alerts, is_owner }) => {
  //console.log(JSON.stringify(layout, null, 2));
  function wrap(segment, isTop, ix, inner) {
    const iconTag = segment.icon ? i({ class: segment.icon }) + "&nbsp;" : "";
    if (isTop && blockDispatch && blockDispatch.wrapTop)
      return blockDispatch.wrapTop(segment, ix, inner);
    else
      return segment.labelFor
        ? label(
            { for: `input${text(segment.labelFor)}` },
            applyTextStyle(segment, iconTag + inner)
          )
        : applyTextStyle(segment, iconTag + inner);
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
    if (segment.type === "pageHeader") {
      return wrap(
        segment,
        isTop,
        ix,
        h1(segment.title) + p(segment.blurb || "")
      );
    }
    if (segment.type === "image") {
      const srctype = segment.srctype || "File";
      return wrap(
        segment,
        isTop,
        ix,
        img({
          class: "w-100",
          alt: segment.alt,
          src:
            srctype === "File" ? `/files/serve/${segment.fileid}` : segment.url,
        })
      );
    }
    if (segment.type === "link") {
      let style =
        segment.link_style === "btn btn-custom-color"
          ? `background-color: ${
              segment.link_bgcol || "#000000"
            };border-color: ${segment.link_bordercol || "#000000"}; color: ${
              segment.link_textcol || "#000000"
            }`
          : null;
      return wrap(
        segment,
        isTop,
        ix,
        a(
          {
            href: segment.url,
            class: [segment.link_style || "", segment.link_size || ""],
            target: segment.target_blank ? "_blank" : false,
            rel: segment.nofollow ? "nofollow" : false,
            style,
          },
          segment.link_icon ? i({ class: segment.link_icon }) + "&nbsp;" : "",
          segment.text
        )
      );
    }
    if (segment.type === "card")
      return wrap(
        segment,
        isTop,
        ix,
        div(
          {
            class: [
              "card mt-4",
              segment.shadow === false ? false : "shadow",
              segment.class,
              segment.url && "with-link",
            ],
            onclick: segment.url ? `location.href='${segment.url}'` : false,
            style: segment.style,
          },
          segment.title &&
            div(
              { class: "card-header" },
              typeof segment.title === "string"
                ? h6(
                    { class: "m-0 font-weight-bold text-primary" },
                    segment.title
                  )
                : segment.title
            ),
          segment.tabContents &&
            div(
              { class: "card-header" },
              ul(
                { class: "nav nav-tabs card-header-tabs" },
                Object.keys(segment.tabContents).map((title, ix) =>
                  li(
                    { class: "nav-item" },
                    a(
                      {
                        class: ["nav-link", ix === 0 && "active"],
                        href: `#tab-${title}`,
                        "data-toggle": "tab",
                        role: "tab",
                      },
                      title
                    )
                  )
                )
              )
            ) +
              div(
                {
                  class: [
                    "card-body",
                    segment.bodyClass,
                    segment.noPadding && "p-0",
                  ],
                },
                div(
                  { class: "tab-content", id: "myTabContent" },
                  Object.entries(segment.tabContents).map(
                    ([title, contents], ix) =>
                      div(
                        {
                          class: ["tab-pane", ix == 0 && "show active"],
                          id: `tab-${title}`,
                        },
                        contents
                      )
                  )
                )
              ),
          segment.contents &&
            div(
              {
                class: [
                  "card-body",
                  segment.bodyClass,
                  segment.noPadding && "p-0",
                ],
              },
              go(segment.contents)
            ),
          segment.footer && div({ class: "card-footer" }, go(segment.footer))
        )
      );
    if (segment.type === "tabs")
      return wrap(segment, isTop, ix, renderTabs(segment, go));
    if (segment.type === "container") {
      const {
        bgFileId,
        bgType,
        bgColor,
        vAlign,
        hAlign,
        block,
        display,
        imageSize,
        borderWidth,
        borderStyle,
        setTextColor,
        textColor,
        showForRole,
        hide,
        customClass,
        customCSS,
        minScreenWidth,
        maxScreenWidth,
        showIfFormulaInputs,
        show_for_owner,
        borderDirection,
        borderRadius,
        borderRadiusUnit,
        borderColor,
        url,
        hoverColor,
        gradStartColor,
        gradEndColor,
        gradDirection,
        fullPageWidth,
        overflow,
        rotate,
        style,
        htmlElement,
      } = segment;
      if (hide) return "";
      if (
        showForRole &&
        showForRole[role] === false &&
        !(show_for_owner && is_owner)
      )
        return "";
      const renderBg = true;
      const sizeProp = (segKey, cssNm, unit) =>
        typeof segment[segKey] === "undefined"
          ? ""
          : `${cssNm}: ${segment[segKey]}${
              unit || segment[segKey + "Unit"] || "px"
            };`;
      const ppCustomCSS = (s) => (s ? s.split("\n").join("") + ";" : "");
      const baseDisplayClass =
        block === false ? "inline-block" : display ? display : "block";
      let displayClass = minScreenWidth
        ? `d-none d-${minScreenWidth}-${baseDisplayClass}`
        : baseDisplayClass === "block"
        ? false // no need
        : `d-${baseDisplayClass}`;
      if (maxScreenWidth)
        displayClass = `${displayClass} d-${maxScreenWidth}-none`;
      const allZero = (xs) => xs.every((x) => +x === 0);
      const ppBox = (what) =>
        !segment[what] || allZero(segment[what])
          ? ""
          : `${what}: ${segment[what].map((p) => p + "px").join(" ")};`;
      let flexStyles = "";
      Object.keys(style || {}).forEach((k) => {
        flexStyles += `${k}:${style[k]};`;
      });
      return wrap(
        segment,
        isTop,
        ix,
        genericElement(
          htmlElement || "div",
          {
            class: [
              customClass || false,
              hAlign && `text-${hAlign}`,
              vAlign === "middle" && "d-flex align-items-center",
              vAlign === "bottom" && "d-flex align-items-end",
              vAlign === "middle" &&
                hAlign === "center" &&
                "justify-content-center",
              displayClass,
              url && "with-link",
              hoverColor && `hover-${hoverColor}`,
              fullPageWidth && "full-page-width",
            ],
            onclick: segment.url ? `location.href='${segment.url}'` : false,

            style: `${flexStyles}${ppCustomCSS(customCSS || "")}${sizeProp(
              "minHeight",
              "min-height"
            )}${sizeProp("height", "height")}${sizeProp(
              "width",
              "width"
            )}${sizeProp("widthPct", "width", "%")}border${
              borderDirection ? `-${borderDirection}` : ""
            }: ${borderWidth || 0}px ${borderStyle} ${
              borderColor || "black"
            };${sizeProp("borderRadius", "border-radius")}${ppBox(
              "padding"
            )}${ppBox("margin")}${
              overflow && overflow !== "visible"
                ? ` overflow: ${overflow};`
                : ""
            } ${
              renderBg && bgType === "Image" && bgFileId && +bgFileId
                ? `background-image: url('/files/serve/${bgFileId}'); background-size: ${
                    imageSize === "repeat" ? "auto" : imageSize || "contain"
                  }; background-repeat: ${
                    imageSize === "repeat" ? "repeat" : "no-repeat"
                  };`
                : ""
            } ${
              renderBg && bgType === "Color"
                ? `background-color: ${bgColor};`
                : ""
            } ${
              renderBg && bgType === "Gradient"
                ? `background-image: linear-gradient(${
                    gradDirection || 0
                  }deg, ${gradStartColor}, ${gradEndColor});`
                : ""
            } ${setTextColor ? `color: ${textColor};` : ""}${
              rotate ? `transform: rotate(${rotate}deg);` : ""
            }`,
            ...(showIfFormulaInputs
              ? {
                  "data-show-if": `showIfFormulaInputs(e, '${showIfFormulaInputs}')`,
                }
              : {}),
          },
          renderBg &&
            bgType === "Image" &&
            bgFileId &&
            +bgFileId &&
            div(
              { style: "display:none" },
              img({
                height: "1",
                width: "1",
                alt: "",
                src: `/files/serve/${bgFileId}`,
              })
            ),
          go(segment.contents)
        )
      );
    }

    if (segment.type === "line_break") {
      return "<br />";
    }
    if (segment.type === "search_bar") {
      return `<form action="/search" method="get">${search_bar("q", "", {
        has_dropdown: segment.has_dropdown,
        contents: go(segment.contents),
      })}</form>`;
    }
    if (segment.above) {
      return segment.above.map((s, ix) => go(s, isTop, ix)).join("");
    } else if (segment.besides) {
      const defwidth = Math.round(12 / segment.besides.length);
      const cardDeck =
        segment.besides.every((s) => s && s.type === "card") &&
        (!segment.widths || segment.widths.every((w) => w === defwidth));
      let markup;
      if (cardDeck)
        markup = div(
          { class: "card-deck" },
          segment.besides.map((t, ixb) => go(t, false, ixb))
        );
      else
        markup = div(
          { class: "row w-100" },
          segment.besides.map((t, ixb) =>
            div(
              {
                class:
                  segment.widths === false
                    ? ""
                    : `col-${
                        segment.breakpoint
                          ? segment.breakpoint + "-"
                          : segment.breakpoints && segment.breakpoints[ixb]
                          ? segment.breakpoints[ixb] + "-"
                          : ""
                      }${segment.widths ? segment.widths[ixb] : defwidth}${
                        segment.aligns ? " text-" + segment.aligns[ixb] : ""
                      }`,
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
      ),
    }),
    is.str
  ),
  render
);
