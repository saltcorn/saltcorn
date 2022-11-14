/**
 * @category saltcorn-markup
 * @module layout
 */

import tags = require("./tags");
import mjml = require("./mjml-tags");
const { div, a, text, img, p, h1, h2, h3, h4, h5, h6, label, ul, li, i, span } =
  tags;
import crypto from "crypto";

/**
 * build a unique className for a style string
 * @param style style string
 * @param prefix prefix of the className
 * @returns className
 */
const createClassName = (style: string, prefix: string) => {
  const hash = crypto.createHash("sha1").update(style).digest("hex");
  return `${prefix}_${hash}`;
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
  const hasStyle = Object.keys(style).length > 0;
  const to_bs5 = (s: string) => (s === "font-italic" ? "fst-italic" : s);
  const labelFor = (s: string) =>
    segment.labelFor ? label({ for: `input${text(segment.labelFor)}` }, s) : s;
  if (segment.textStyle && segment.textStyle.startsWith("h") && segment.inline)
    style.display = "inline-block";
  const wrapText = (s: string) => mjml.text({ padding: "0px" }, labelFor(s));
  switch (segment.textStyle) {
    case "h1":
      return wrapText(h1({ style }, inner));
    case "h2":
      return wrapText(h2({ style }, inner));
    case "h3":
      return wrapText(h3({ style }, inner));
    case "h4":
      return wrapText(h4({ style }, inner));
    case "h5":
      return wrapText(h5({ style }, inner));
    case "h6":
      return wrapText(h6({ style }, inner));
    default:
      return segment.block || segment.textStyle || hasStyle
        ? mjml.text(
            div({ style, class: to_bs5(segment.textStyle || "") }, inner)
          )
        : mjml.text(
            span({ style, class: to_bs5(segment.textStyle || "") }, inner)
          );
  }
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
    return isTop
      ? mjml.section({ padding: "0px" }, mjml.column(content))
      : content;
  }
  const styles = new Array<any>();
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
      return rendered ? wrap(segment, isTop, ix, rendered) : "";
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
      const { style, alt, fileid, url } = segment;
      const srctype = segment.srctype || "File";
      const urlFromReq = req.get_base_url();
      const base_url = urlFromReq.endsWith("/")
        ? urlFromReq.substring(0, urlFromReq.length - 1)
        : urlFromReq;
      let styleString = "";
      Object.keys(style || {}).forEach((k) => {
        styleString += `${k}:${style[k]};`;
      });
      const className = createClassName(styleString, "image");
      styles.push({ className, style: styleString });
      const mjImage = mjml.image({
        //class: segment.style && segment.style.width ? null : "w-100",
        alt: alt,
        "css-class": className,
        src: srctype === "File" ? `${base_url}/files/serve/${fileid}` : url,
      });
      return isTop
        ? mjml.section({ padding: "0px" }, mjml.column(mjImage))
        : mjImage;
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
      const content = wrap(
        segment,
        isTop,
        ix,
        mjml.raw(
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
        )
      );
      return isTop
        ? mjml.section({ padding: "0px" }, mjml.column(content))
        : content;
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
      const styleString = `${flexStyles}${ppCustomCSS(
        customCSS || ""
      )}${sizeProp("minHeight", "min-height")}${sizeProp(
        "height",
        "height"
      )}${sizeProp("width", "width")}${sizeProp(
        "widthPct",
        "width",
        "%"
      )}border${borderDirection ? `-${borderDirection}` : ""}: ${
        borderWidth || 0
      }px ${borderStyle} ${borderColor || "black"};${sizeProp(
        "borderRadius",
        "border-radius"
      )}${ppBox("padding")}${ppBox("margin")}${
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
      }`;
      const className = createClassName(styleString, "container");
      styles.push({ className, style: styleString });
      const tagCfg: any = {
        /*class: [
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
        ],*/
        onclick: segment.url ? `location.href='${segment.url}'` : false,
        "css-class": className,
        // ...(showIfFormulaInputs
        //   ? {
        //       "data-show-if": encodeURIComponent(
        //         `showIfFormulaInputs(e, '${showIfFormulaInputs}')`
        //       ),
        //     }
        //   : {}),
      };
      const bg =
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
        );
      const content = go(segment.contents);
      if (isTop) {
        tagCfg.padding = "0px";
        return mjml.section(tagCfg, bg, mjml.column(content));
      } else {
        return mjml.text(tagCfg, bg, content);
      }
    }
    if (segment.type === "line_break") {
      return mjml.raw("<br />");
    }
    if (segment.above) {
      return segment.above
        .map((s: any, ix: number) => go(s, isTop, ix))
        .join("");
    } else if (segment.besides) {
      const defwidth = Math.round(12 / segment.besides.length);
      let styleString = "";
      Object.keys(segment.style || {}).forEach((k) => {
        styleString += `${k}:${segment.style[k]};`;
      });
      const className = createClassName(styleString, "group");
      styles.push({ className, style: styleString });
      const inner = segment.besides.map((t: any, ixb: number) =>
        mjml.column(
          {
            width: `${Math.round(
              (100 * (segment.widths ? segment.widths[ixb] : defwidth)) / 12
            )}%`,
          },
          go(t, false, ixb)
        )
      );
      const tagCfg = {
        /*class: ["row", segment.style && segment.style.width ? null : "w-100"],*/
        "css-class": className,
      };
      // TODO mj-group is not allowed in mj-column but it seems to work
      return isTop
        ? mjml.section({ padding: "0px" }, tagCfg, inner)
        : mjml.group(tagCfg, inner);
    } else throw new Error("unknown layout segment" + JSON.stringify(segment));
  }
  return { markup: go(layout, true, 0), styles };
};

// declaration merging
const LayoutExports = render;
export = LayoutExports;
