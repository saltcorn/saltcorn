import tags = require("./tags");
const { table, tr, td } = tags;
import mjml = require("./mjml-tags");
const {
  div,
  a,
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
  li,
  i,
  span,
  text,
  genericElement,
} = tags;
import crypto from "crypto";

const isBlock = (segment: any) => {
  if (["h1", "h2", "h3", "h4", "h5", "h6"].indexOf(segment.textStyle) >= 0) {
    return !segment.inline;
  } else {
    return segment.block;
  }
};

const transformTextStyle = (textStyle: string) => {
  switch (textStyle) {
    case "h1":
      return {
        "font-size": "2em",
        "margin-top": "0.67em",
        "margin-bottom": "0.67em",
        "margin-left": 0,
        "margin-right": 0,
        "font-weight": "bold",
      };
    case "h2":
      return {
        "font-size": "1.5em",
        "margin-top": "0.83em",
        "margin-bottom": "0.83em",
        "margin-left": "0",
        "margin-right": "0",
        "font-weight": "bold",
      };
    case "h3":
      return {
        "font-size": "1.17em",
        "margin-top": "1em",
        "margin-bottom": "1em",
        "margin-left": "0",
        "margin-right": "0",
        "font-weight": "bold",
      };
    case "h4":
      return {
        "font-size": "1em",
        "margin-top": "1.33em",
        "margin-bottom": "1.33em",
        "margin-left": "0",
        "margin-right": "0",
        "font-weight": "bold",
      };
    case "h5":
      return {
        "font-size": ".83em",
        "margin-top": "1.67em",
        "margin-bottom": "1.67em",
        "margin-left": "0",
        "margin-right": "0",
        "font-weight": "bold",
      };
    case "h6":
      return {
        "font-size": ".67em",
        "margin-top": "2.33em",
        "margin-bottom": "2.33em",
        "margin-left": "0",
        "margin-right": "0",
        "font-weight": "bold",
      };
    case "fw-bold":
      return { "font-weight": "700 !important" };
    case "fst-italic":
      return { "font-style": "italic !important" };
    case "small":
      return { "font-size": "0.875em" };
    case "text-muted":
      return {
        "--bs-text-opacity": "1",
        color: "#858796 !important",
      };
    case "text-underline":
      return {
        "text-decoration": "underline",
      };
    case "font-monospace":
      return {
        "font-family": "monospace !important",
      };
    default:
      return {};
  }
};

const transformLinkSize = (linkSize: string) => {
  switch (linkSize) {
    case "btn-lg":
    case "btn-block btn-lg":
      return {
        padding: "0.5rem 1rem",
        "font-size": "1.25rem",
      };
    case "btn-sm":
      return {
        padding: "0.25rem 0.5rem",
        "font-size": "0.875rem",
      };
    case "btn-block":
    default:
      return {};
  }
};

/**
 *
 * @param segment
 * @param inner
 * @returns
 */
const applyTextStyle = (segment: any, inner: string): string => {
  const style: any = segment.font
    ? { fontFamily: segment.font, ...segment.style }
    : segment.style || {};
  const hasStyle =
    Object.entries(style).filter(([k, v]): any => {
      return v && v !== "" && v !== "px";
    }).length > 0;
  const textStyle = transformTextStyle(segment.textStyle);
  const linkSize = transformLinkSize(segment.link_size);
  const _style = { ...style, ...textStyle, ...linkSize };
  return isBlock(segment)
    ? div({ style: _style }, inner)
    : segment.textStyle || hasStyle
    ? span({ style: _style }, inner)
    : inner;
};

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
 * @param opts
 * @param opts.blockDispatch
 * @param opts.layout
 * @param opts.role
 * @param opts.alerts
 * @param opts.is_owner
 * @prams req
 * @returns
 */
const render = ({
  blockDispatch,
  layout,
  role,
  alerts,
  is_owner,
  req,
}: RenderOpts): any => {
  //console.log(JSON.stringify(layout, null, 2));
  function wrap(segment: any, isTop: boolean, ix: number, inner: string) {
    const iconTag = segment.icon ? i({ class: segment.icon }) + "&nbsp;" : "";
    const content = applyTextStyle(segment, iconTag + inner);
    return content;
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
      const rendered = blockDispatch[segment.type](segment, go);
      if (!rendered) return "";
      else {
        return wrap(segment, isTop, ix, rendered);
      }
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
      const { alt, fileid, url } = segment;
      const srctype = segment.srctype || "File";
      const urlFromReq = req.get_base_url();
      const base_url = urlFromReq.endsWith("/")
        ? urlFromReq.substring(0, urlFromReq.length - 1)
        : urlFromReq;
      const style = segment.style ? segment.style : {};
      if (!style.width) style.width = "100% !important";
      const inner = img({
        style: style,
        alt: alt,
        src: srctype === "File" ? `${base_url}/files/serve/${fileid}` : url,
      });
      return segment.block ? div(inner) : inner;
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
            target: segment.target_blank ? "_blank" : false,
            rel: segment.nofollow ? "nofollow" : false,
            style,
          },
          segment.link_icon ? i({ class: segment.link_icon }) + "&nbsp;" : "",
          segment.text
        )
      );
    }
    if (segment.type === "card") {
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
                ? h6({ class: "m-0 fw-bold text-primary" }, segment.title)
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
    }

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
      const allZero = (xs: any) => xs.every((x: number) => +x === 0);
      const ppBox = (what: string) =>
        !segment[what] || allZero(segment[what])
          ? ""
          : `${what}: ${segment[what].map((p: string) => p + "px").join(" ")};`;
      let flexStyles = "";
      Object.keys(style || {}).forEach((k) => {
        if (style[k]) flexStyles += `${k}:${style[k]};`;
      });
      let styleString = `${flexStyles}${ppCustomCSS(customCSS || "")}${sizeProp(
        "minHeight",
        "min-height"
      )}${sizeProp("height", "height")}${sizeProp("width", "width")}${sizeProp(
        "widthPct",
        "width",
        "%"
      )}
      ${ppBox("padding")}${ppBox("margin")}${
        overflow && overflow !== "visible" ? ` overflow: ${overflow};` : ""
      } ${
        renderBg && bgType === "Image" && bgFileId && +bgFileId
          ? `background-image: url('/files/serve/${bgFileId}'); background-size: ${
              imageSize === "repeat" ? "auto" : imageSize || "contain"
            }; background-repeat: ${
              imageSize === "repeat" ? "repeat" : "no-repeat"
            };`
          : ""
      } ${
        renderBg && bgType === "Color" ? `background-color: ${bgColor};` : ""
      } ${
        renderBg && bgType === "Gradient"
          ? `background-image: linear-gradient(${
              gradDirection || 0
            }deg, ${gradStartColor}, ${gradEndColor});`
          : ""
      } ${setTextColor ? `color: ${textColor};` : ""}${
        rotate ? `transform: rotate(${rotate}deg);` : ""
      } ${display === "none" ? "display: none; " : ""}`;
      if (!style || !(style["border-width"] && style["border-style"])) {
        styleString += `border${
          borderDirection ? `-${borderDirection}` : ""
        }: ${borderWidth || 0}px ${borderStyle ? borderStyle : "none"} ${
          borderColor || "black"
        };${sizeProp("borderRadius", "border-radius")}`;
      }
      return genericElement(
        display === "inline" || display === "inline-block" ? "span" : "div",
        {
          style: styleString,
        },
        go(segment.contents, false, ix)
      );
      // const bg =
      //   renderBg &&
      //   bgType === "Image" &&
      //   bgFileId &&
      //   +bgFileId &&
      //   div(
      //     { style: "display:none" },
      //     img({
      //       height: "1",
      //       width: "1",
      //       alt: "",
      //       src: `/files/serve/${bgFileId}`,
      //     })
      //   );
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
      return table(
        { width: "100%", style: segment.style },
        tr(
          segment.besides.map((t: any, ixb: number) => {
            return td(
              {
                width: `${Math.round(
                  (100 * (segment.widths ? segment.widths[ixb] : defwidth)) / 12
                )}%`,
              },
              go(t, false, ixb)
            );
          })
        )
      );
    } else throw new Error("unknown layout segment" + JSON.stringify(segment));
  }
  if (req.isSubView) {
    return go(layout, true, 0);
  } else if (layout.type === "container") {
    const inner = div(
      { style: "text-align: left !important; font-size: 16px;" },
      go(layout.contents, true, 0)
    );
    return {
      markup: mjml.section(mjml.raw(inner)),
      backgroundColor: layout.bgColor,
    };
  } else {
    const inner = div(
      { style: "text-align: left !important; font-size: 16px;" },
      go(layout, true, 0)
    );
    return { markup: mjml.section(mjml.raw(inner)) };
  }
};

// declaration merging
const LayoutExports = render;
export = LayoutExports;
