/**
 * @category saltcorn-markup
 * @module layout
 */

import tags = require("./tags");
import mjml = require("./mjml-tags");
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
} = tags;

import helpers = require("./helpers");

/**
 *
 * @param {any} segment
 * @param {string} inner
 * @returns {div|span|string}
 */
const applyTextStyle = (segment: any, inner: string): string => {
  let style: any = segment.font ? { fontFamily: segment.font } : {};
  if (segment.textStyle && segment.textStyle.startsWith("h") && segment.inline)
    style.display = "inline-block";
  switch (segment.textStyle) {
    case "h1":
      return h1({ style }, inner);
    case "h2":
      return h2({ style }, inner);
    case "h3":
      return h3({ style }, inner);
    case "h4":
      return h4({ style }, inner);
    case "h5":
      return h5({ style }, inner);
    case "h6":
      return h6({ style }, inner);
    default:
      return segment.block
        ? div({ class: segment.textStyle || "", style }, inner)
        : segment.textStyle || segment.font
        ? span({ class: segment.textStyle || "", style }, inner)
        : inner;
  }
};

// declaration merging
namespace LayoutExports {
  export type RenderTabsOpts = {
    contents: any[];
    titles: string[];
    tabsStyle: string;
    ntabs?: any;
    independent: boolean;
  };
}
type RenderTabsOpts = LayoutExports.RenderTabsOpts;

function validID(s: string) {
  return s
    ? s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/^[^a-z]+|[^\w:.-]+/gi, "")
    : s;
}

// declaration merging
namespace LayoutExports {
  export type RenderOpts = {
    blockDispatch?: any;
    layout: any;
    role?: any;
    alerts?: any;
    is_owner?: boolean;
    req?: any;
  };
}
type RenderOpts = LayoutExports.RenderOpts;

/**
 * @param {object} opts
 * @param {object} opts.blockDispatch
 * @param {object|string} opts.layout
 * @param {object} [opts.role]
 * @param {object[]} [opts.alerts]
 * @param {boolean} opts.is_owner
 * @returns {string}
 */
const render = ({
  blockDispatch,
  layout,
  role,
  alerts,
  is_owner,
  req,
}: RenderOpts): string => {
  //console.log(JSON.stringify(layout, null, 2));
  function wrap(segment: any, isTop: boolean, ix: number, inner: string) {
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
  function go(segment: any, isTop: boolean = false, ix: number = 0): string {
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
        mjml.image({
          class: segment.style && segment.style.width ? null : "w-100",
          alt: segment.alt,
          style: segment.style,
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
                        "data-bs-toggle": "tab",
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
      const sizeProp = (segKey: string, cssNm: string, unit?: string) =>
        typeof segment[segKey] === "undefined"
          ? ""
          : `${cssNm}: ${segment[segKey]}${
              unit || segment[segKey + "Unit"] || "px"
            };`;
      const ppCustomCSS = (s?: string) =>
        s ? s.split("\n").join("") + ";" : "";
      const baseDisplayClass =
        block === false ? "inline-block" : display ? display : "block";
      let displayClass = minScreenWidth
        ? `d-none d-${minScreenWidth}-${baseDisplayClass}`
        : baseDisplayClass === "block"
        ? false // no need
        : `d-${baseDisplayClass}`;
      if (maxScreenWidth)
        displayClass = `${displayClass} d-${maxScreenWidth}-none`;
      const allZero = (xs: any) => xs.every((x: number) => +x === 0);
      const ppBox = (what: string) =>
        !segment[what] || allZero(segment[what])
          ? ""
          : `${what}: ${segment[what].map((p: string) => p + "px").join(" ")};`;
      let flexStyles = "";
      Object.keys(style || {}).forEach((k) => {
        flexStyles += `${k}:${style[k]};`;
      });
      return wrap(
        segment,
        isTop,
        ix,
        mjml.section(
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
                  "data-show-if": encodeURIComponent(
                    `showIfFormulaInputs(e, '${showIfFormulaInputs}')`
                  ),
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

    if (segment.above) {
      return segment.above
        .map((s: any, ix: number) => go(s, isTop, ix))
        .join("");
    } else if (segment.besides) {
      const defwidth = Math.round(12 / segment.besides.length);

      let markup;

      markup = mjml.section(
        {
          class: ["row", segment.style && segment.style.width ? null : "w-100"],
          style: segment.style,
        },
        segment.besides.map((t: any, ixb: number) =>
          mjml.column(
            {
              width: `${Math.round(
                (100 * (segment.widths ? segment.widths[ixb] : defwidth)) / 12
              )}`,
            },
            go(t, false, ixb)
          )
        )
      );
      return isTop ? wrap(segment, isTop, ix, markup) : markup;
    } else throw new Error("unknown layout segment" + JSON.stringify(segment));
  }
  return go(layout, true, 0);
};

// declaration merging
const LayoutExports = render;
export = LayoutExports;
