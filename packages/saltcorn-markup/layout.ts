/**
 * @category saltcorn-markup
 * @module layout
 */

import tags = require("./tags");
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
  table,
  tr,
  td,
  tbody,
} = tags;
const { toast, breadcrumbs, renderTabs } = require("./layout_utils");
import type { Layout } from "@saltcorn/types/base_types";
import { instanceOWithHtmlFile } from "@saltcorn/types/base_types";
import helpers = require("./helpers");
import renderMJML from "./mjml-layout";
const { search_bar } = helpers;

declare const window: any;

/**
 * @param {any|any[]} [alerts]
 * @returns {boolean}
 */
const couldHaveAlerts = (alerts?: any | any[]): boolean =>
  alerts || Array.isArray(alerts);

/**
 * @param {string|any} body
 * @param {object[]} [alerts]
 * @returns {object}
 */
const makeSegments = (
  body: string | any,
  alerts: any[],
  isWeb: boolean
): any => {
  const toastSegments = couldHaveAlerts(alerts)
    ? [
        {
          type: "blank",
          contents: div(
            {
              id: "toasts-area",
              class: `toast-container position-fixed ${
                isWeb ? "top-0 end-0 p-2" : "bottom-0 start-50 p-0"
              } `,
              style: `z-index: 999; ${!isWeb ? "margin-bottom: 1.0rem" : ""}`,
              "aria-live": "polite",
              "aria-atomic": "true",
            },
            (alerts || []).map((a: any) => toast(a.type, a.msg))
          ),
        },
      ]
    : [];

  if (typeof body === "string")
    return {
      above: [{ type: "blank", contents: body }, ...toastSegments],
    };
  else if (body.above) {
    if (couldHaveAlerts(alerts)) body.above.push(toastSegments[0]);
    return body;
  } else
    return {
      above: [body, ...toastSegments],
    };
};

/**
 *
 * @param {any} segment
 * @param {string} inner
 * @returns {div|span|string}
 */
const selfStylingTypes = new Set(["card", "container", "besides", "image"]);

const applyTextStyle = (segment: any, inner: string): string => {
  const style: any = segment.font
    ? { fontFamily: segment.font, ...segment.style }
    : segment.style || {};
  const hasStyle =
    Object.keys(style).length > 0 && !selfStylingTypes.has(segment.type);
  const to_bs5 = (s: string) => (s === "font-italic" ? "fst-italic" : s);
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
      return segment.block || (segment.display === "block" && hasStyle)
        ? div({ class: to_bs5(segment.textStyle || ""), style }, inner)
        : segment.textStyle || hasStyle
        ? span({ class: to_bs5(segment.textStyle || ""), style }, inner)
        : inner;
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
  if (instanceOWithHtmlFile(layout))
    throw new Error("Please don't try to use HTML files in render()");
  //console.log(JSON.stringify(layout, null, 2));
  const isWeb = typeof window === "undefined" && !req?.smr;
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
      const resp = blockDispatch[segment.type](segment, go);
      if (resp !== false) return wrap(segment, isTop, ix, resp);
      //else continue below
    }
    if (segment.type === "blank") {
      return wrap(segment, isTop, ix, segment.contents || "");
    }
    if (segment.type === "breadcrumbs") {
      return wrap(
        segment,
        isTop,
        ix,
        breadcrumbs(segment.crumbs || [], segment.right, segment.after)
      );
    }
    if (segment.type === "view") {
      return wrap(segment, isTop, ix, segment.contents || "");
    }
    if (segment.type === "page") {
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
    if (segment.type === "table") {
      const ntimes = (n: number, f: (i: number) => any) => {
        const res = [];
        for (let index = 0; index < n; index++) {
          res.push(f(index));
        }
        return res;
      };
      const {
        bs_style,
        bs_small,
        bs_striped,
        bs_bordered,
        bs_borderless,
        bs_wauto,
      } = segment;
      const tabHtml = table(
        {
          class: !bs_style
            ? []
            : [
                "table",
                bs_small && "table-sm",
                bs_striped && "table-striped",
                bs_bordered && "table-bordered",
                bs_borderless && "table-borderless",
                bs_wauto && "w-auto",
              ],
        },
        tbody(
          ntimes(segment.rows, (ri) =>
            tr(
              ntimes(segment.columns, (ci) =>
                td(go(segment.contents?.[ri]?.[ci]))
              )
            )
          )
        )
      );
      return wrap(segment, isTop, ix, tabHtml);
    }
    if (segment.type === "image") {
      const srctype = segment.srctype || "File";
      const src = isWeb
        ? srctype === "File"
          ? `/files/serve/${encodeURIComponent(segment.fileid)}`
          : segment.url
        : segment.encoded_image
        ? segment.encoded_image
        : segment.url;
      const imageCfg: any = {
        class: segment.style && segment.style.width ? null : "w-100",
        alt: segment.alt,
        style: segment.style,
        srcset:
          segment.imgResponsiveWidths && srctype === "File"
            ? segment.imgResponsiveWidths
                .split(",")
                .map(
                  (w: string) =>
                    `/files/resize/${w.trim()}/0/${encodeURIComponent(
                      segment.fileid
                    )} ${w.trim()}w`
                )
                .join(",")
            : undefined,
        src,
      };
      if (!isWeb && !segment.encoded_image) {
        imageCfg["mobile-img-path"] =
          srctype === "File"
            ? segment.fileid
            : segment.url?.startsWith("/files/serve/")
            ? segment.url.substr(13)
            : undefined;
      }
      return wrap(segment, isTop, ix, img(imageCfg));
    }
    if (segment.type === "dropdown_menu") {
      const rndid = `actiondd${Math.floor(Math.random() * 16777215).toString(
        16
      )}`;

      let style =
        segment.action_style === "btn-custom-color"
          ? `background-color: ${
              segment.action_bgcol || "#000000"
            };border-color: ${segment.action_bordercol || "#000000"}; color: ${
              segment.action_textcol || "#000000"
            }`
          : null;
      return div(
        { class: "dropdown" },
        button(
          {
            class:
              segment.action_style === "btn-link"
                ? ""
                : `btn ${segment.action_style || "btn-primary"} ${
                    segment.action_size || ""
                  } dropdown-toggle`,

            "data-boundary": "viewport",
            type: "button",
            id: rndid,
            "data-bs-toggle": "dropdown",
            "aria-haspopup": "true",
            "aria-expanded": "false",
            style,
          },
          segment.label || "Actions"
        ),
        div(
          {
            class: "dropdown-menu dropdown-menu-end",
            "aria-labelledby": rndid,
          },
          div({ class: "d-flex flex-column px-2" }, go(segment.contents))
        )
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
            href: segment.in_modal
              ? isWeb
                ? `javascript:ajax_modal('${segment.url}');`
                : `javascript:mobile_modal('${segment.url}');`
              : isWeb
              ? segment.url
              : `javascript:execLink('${segment.url}', '${
                  segment.link_src || "URL"
                }')`,
            class: [segment.link_style || "", segment.link_size || ""],
            target: isWeb && segment.target_blank ? "_blank" : false,
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
              "card",
              !(segment.class || "").includes("mt-") && "mt-4",
              segment.shadow === false ? false : "shadow",
              segment.class,
              segment.url && "with-link",
            ],
            onclick: segment.url
              ? isWeb
                ? `location.href='${segment.url}'`
                : `execLink('${segment.url}')`
              : false,
            style: segment.style,
          },
          segment.title &&
            span(
              { class: "card-header" },
              typeof segment.title === "string"
                ? h5(
                    { class: "m-0 fw-bold text-primary d-inline" },
                    segment.title
                  )
                : segment.title,
              segment.subtitle ? span(segment.subtitle) : "",
              segment.titleAjaxIndicator &&
                span(
                  {
                    class: "float-end sc-ajax-indicator",
                    style: { display: "none" },
                  },
                  i({ class: "fas fa-save" })
                )
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
    if (segment.type === "tabs") {
      return wrap(
        segment,
        isTop,
        ix,
        renderTabs(
          segment,
          go,
          segment.serverRendered
            ? req.query[segment.tabId || "_tab"]
            : undefined
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
        imgResponsiveWidths,
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
      const to_bs5 = (s: string) => {
        if (s === "left") return "start";
        if (s === "right") return "end";
        return s;
      };
      const hasImgBg = renderBg && bgType === "Image" && bgFileId;
      const useImgTagAsBg = hasImgBg && imageSize !== "repeat" && isTop;
      let image = undefined;
      if (hasImgBg && useImgTagAsBg) {
        const imgCfg: any = {
          class: `containerbgimage `,
          srcset: imgResponsiveWidths
            ? imgResponsiveWidths
                .split(",")
                .map(
                  (w: string) =>
                    `/files/resize/${w.trim()}/0/${bgFileId} ${w.trim()}w`
                )
                .join(",")
            : undefined,
          style: { "object-fit": imageSize || "contain" },
          alt: "",
        };
        if (isWeb) imgCfg.src = `/files/serve/${bgFileId}`;
        else imgCfg["mobile-img-path"] = bgFileId;
        image = img(imgCfg);
      }
      const legacyBorder = borderWidth
        ? `border${borderDirection ? `-${borderDirection}` : ""}: ${
            borderWidth || 0
          }px ${borderStyle || "none"} ${borderColor || "black"};`
        : "";
      return wrap(
        segment,
        isTop,
        ix,
        genericElement(
          htmlElement || "div",
          {
            class: [
              customClass || false,
              hAlign && `text-${to_bs5(hAlign)}`,
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
            onclick: segment.url
              ? isWeb
                ? `location.href='${segment.url}'`
                : `execLink('${segment.url}')`
              : false,

            style: `${flexStyles}${ppCustomCSS(customCSS || "")}${sizeProp(
              "minHeight",
              "min-height"
            )}${sizeProp("height", "height")}${sizeProp(
              "width",
              "width"
            )}${sizeProp("widthPct", "width", "%")}${legacyBorder}${sizeProp(
              "borderRadius",
              "border-radius"
            )}${ppBox("padding")}${ppBox("margin")}${
              overflow && overflow !== "visible"
                ? ` overflow: ${overflow};`
                : ""
            } ${
              hasImgBg && !useImgTagAsBg
                ? ` ${
                    isWeb
                      ? `background-image: url('/files/serve/${bgFileId}');`
                      : ""
                  } background-size: ${
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
            }${showIfFormulaInputs ? ` display: none;` : ``}`,
            ...(showIfFormulaInputs
              ? {
                  "data-show-if": encodeURIComponent(
                    `showIfFormulaInputs(e, '${showIfFormulaInputs}')`
                  ),
                }
              : {}),
            ...(!isWeb && hasImgBg && !useImgTagAsBg
              ? { "mobile-bg-img-path": bgFileId }
              : {}),
          },
          hasImgBg && useImgTagAsBg && image,

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
        autofocus: segment.autofocus,
        contents: go(segment.contents),
      })}</form>`;
    }
    if (segment.above) {
      return segment.above
        .map((s: any, segmentIx: number) => go(s, isTop, segmentIx + ix))
        .join("");
    } else if (segment.besides) {
      const defwidth = Math.round(12 / segment.besides.length);
      const cardDeck =
        segment.besides.every((s: any) => s && s.type === "card") &&
        (!segment.widths || segment.widths.every((w: any) => w === defwidth));
      let markup;

      if (cardDeck)
        markup = div(
          {
            class: [
              `row row-cols-1 row-cols-md-${segment.besides.length} g-4`,
              !segment.style?.["margin-bottom"] && `mb-3`,
            ],
            style: segment.style,
          },
          segment.besides.map((t: any, ixb: number) => {
            const newt = { ...t };
            newt.class = t.class
              ? Array.isArray(t.class)
                ? ["h-100", ...t.class]
                : t.class + " h-100"
              : "h-100";
            return div({ class: "col" }, go(newt, false, ixb));
          })
        );
      else
        markup = div(
          {
            class: [
              "row",
              segment.style && segment.style.width ? null : "w-100",
              typeof segment.gx !== "undefined" &&
                segment.gx !== null &&
                `gx-${segment.gx}`,
              typeof segment.gy !== "undefined" &&
                segment.gy !== null &&
                `gy-${segment.gy}`,
            ],
            style: segment.style,
          },
          segment.besides.map((t: any, ixb: number) =>
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
                      }${
                        segment.vAligns
                          ? " align-items-" + segment.vAligns[ixb]
                          : ""
                      }${
                        segment.colClasses?.[ixb]
                          ? " " + segment.colClasses[ixb]
                          : ""
                      }`,
                style: segment.colStyles?.[ixb] || undefined,
              },
              go(t, false, ixb)
            )
          )
        );
      return isTop ? wrap(segment, isTop, ix, markup) : markup;
    } else throw new Error("unknown layout segment" + JSON.stringify(segment));
  }
  if (req && req.generate_email)
    return renderMJML({
      blockDispatch,
      layout,
      role,
      alerts,
      is_owner,
      req,
    });
  else return go(makeSegments(layout, alerts, isWeb), true, 0);
};

// declaration merging
const LayoutExports = render;
export = LayoutExports;
