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
  iframe,
  script,
  text_attr,
} = tags;
const {
  toast,
  breadcrumbs,
  renderTabs,
  show_icon,
  show_icon_and_label,
} = require("./layout_utils");
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
  const toastSegments =
    couldHaveAlerts(alerts) && !body.noWrapTop
      ? [
          {
            type: "blank",
            contents: div(
              {
                id: "toasts-area",
                class: `toast-container position-fixed ${
                  isWeb
                    ? "top-0 end-0 p-2"
                    : "bottom-0 start-50 p-0 mobile-toast-margin"
                } `,
                style: "z-index: 9999;",
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

const textStyleToArray = (textStyle: any) =>
  Array.isArray(textStyle) ? textStyle : !textStyle ? [] : [textStyle];

const applyTextStyle = (segment: any, inner: string): string => {
  const to_bs5 = (s: string) => (s === "font-italic" ? "fst-italic" : s);
  const styleArray = textStyleToArray(segment.textStyle);
  const hs = styleArray.find((s) => s[0] === "h");
  const klasses = styleArray.filter((s) => s[0] !== "h").map(to_bs5);
  const inline_h = segment.textStyle && hs && segment.inline;
  const style: any = segment.font
    ? { fontFamily: segment.font, ...segment.style }
    : segment.style || {};
  const hasStyle =
    Object.keys(style).length > 0 && !selfStylingTypes.has(segment.type);

  if (inline_h) style.display = "inline-block";
  if (segment.customClass) klasses.push(segment.customClass);
  const klass = klasses.join(" ");

  switch (hs) {
    case "h1":
      return h1({ style, class: klass }, inner);
    case "h2":
      return h2({ style, class: klass }, inner);
    case "h3":
      return h3({ style, class: klass }, inner);
    case "h4":
      return h4({ style, class: klass }, inner);
    case "h5":
      return h5({ style, class: klass }, inner);
    case "h6":
      return h6({ style, class: klass }, inner);
    default:
      return segment.block || (segment.display === "block" && hasStyle)
        ? div({ class: klass, style }, inner)
        : segment.textStyle || hasStyle || klass
          ? span({ class: klass, style }, inner)
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
    hints?: any;
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
  hints = {},
}: RenderOpts): string => {
  //console.log(JSON.stringify(layout, null, 2));
  const isWeb = typeof window === "undefined" && !req?.smr;
  //const hints = blockDispatch?.hints || {};
  function wrap(segment: any, isTop: boolean, ix: number, inner: string) {
    const iconTag = segment.icon
      ? show_icon(segment.icon, "", true) + "&nbsp;"
      : "";
    if (isTop && blockDispatch && blockDispatch.wrapTop && !layout?.noWrapTop)
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
        class: [
          segment.style && segment.style.width ? null : "w-100",
          segment.customClass,
        ],
        alt: segment.alt,
        style: segment.style,
        srcset:
          segment.imgResponsiveWidths &&
          segment.fileid &&
          (srctype === "File" || srctype === "Field")
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
                ? "btn btn-link"
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
          show_icon_and_label(
            segment.action_icon,
            segment.label ||
              (!segment.action_icon || segment.action_icon == "empty"
                ? "Actions"
                : ""),
            segment.label && "me-1"
          )
        ),
        div(
          {
            class: [
              "dropdown-menu",
              segment.menu_direction === "end" && "dropdown-menu-end",
            ],
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
            ...(isWeb
              ? {
                  href: segment.in_modal
                    ? `javascript:ajax_modal('${segment.url}');`
                    : segment.url,
                }
              : {
                  onclick: segment.in_modal
                    ? `javascript:mobile_modal('${segment.url}');`
                    : `execLink('${segment.url}', '${
                        segment.link_src || "URL"
                      }')`,
                }),
            class: [
              segment.link_style || "",
              segment.link_size || "",
              segment.link_class || "",
            ],
            target: isWeb && segment.target_blank ? "_blank" : false,
            title: segment.link_title,
            rel: segment.nofollow ? "nofollow" : false,
            style,
          },
          show_icon_and_label(segment.link_icon, segment.text)
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
              hints.cardClass,
            ],
            ...(segment.id ? { id: segment.id } : {}),
            onclick: segment.url
              ? isWeb
                ? segment.url?.startsWith?.("javascript:")
                  ? text_attr(segment.url.replace("javascript:", ""))
                  : `location.href='${segment.url}'`
                : `execLink('${segment.url}')`
              : false,
            style: segment.style,
          },
          segment.title &&
            span(
              { class: "card-header" },
              typeof segment.title === "string"
                ? hints.cardTitleWrapDiv
                  ? div(
                      { class: "card-title" },
                      genericElement(
                        `h${hints.cardTitleHeader || 5}`,
                        segment.title
                      )
                    )
                  : genericElement(
                      `h${hints.cardTitleHeader || 5}`,
                      {
                        class:
                          hints.cardTitleClass ||
                          "m-0 fw-bold text-primary d-inline",
                      },
                      segment.title
                    )
                : segment.title,
              segment.subtitle ? span(segment.subtitle) : "",
              segment.titleAjaxIndicator &&
                span(
                  {
                    class: "float-end ms-auto sc-ajax-indicator",
                    style: { display: "none" },
                  },
                  i({ class: "fas fa-save" })
                ),
              segment.titleErrorInidicator &&
                span(
                  {
                    class: "float-end sc-error-indicator",
                    style: { display: "none", color: "#ff0033" },
                  },
                  i({ class: "fas fa-exclamation-triangle" })
                )
            ),
          segment.tabContents && // TODO remove all calls to this, use tab in content instead
            div(
              { class: "card-header" },
              ul(
                { class: ["nav nav-tabs card-header-tabs", hints.tabClass] },
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
            (segment.contents.type === "tabs" &&
            segment.contents.tabsStyle !== "Value switch"
              ? renderTabs(
                  {
                    tabClass: "card-header-tabs",
                    headerWrapperClass: "card-header",
                    contentWrapperClass: [
                      "card-body",
                      segment.bodyClass,
                      segment.noPadding && "p-0",
                    ],
                    ...segment.contents,
                  },
                  go,
                  segment.serverRendered
                    ? req?.query?.[segment.tabId || "_tab"]
                    : undefined,
                  hints
                )
              : div(
                  {
                    class: [
                      "card-body",
                      segment.bodyClass,
                      segment.noPadding && "p-0",
                    ],
                  },
                  go(segment.contents)
                )),
          (segment.hasFooter ||
            (segment.footer && segment.hasFooter !== false)) &&
            div({ class: "card-footer" }, go(segment.footer))
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
            ? req?.query?.[segment.tabId || "_tab"]
            : undefined,
          hints,
          !isWeb
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
        customId,
        customCSS,
        minScreenWidth,
        maxScreenWidth,
        showIfFormulaInputs,
        showIfFormulaJoinFields,
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
        transform,
        imgResponsiveWidths,
        htmlElement,
        animateName,
        animateDelay,
        animateDuration,
        animateInitialHide,
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

      const transforms: any = { ...transform };
      if (rotate && rotate !== "0") transforms.rotate = `${rotate}deg`;
      let stransform = Object.keys(transforms).length
        ? "transform: " +
          Object.entries(transforms)
            .filter(([k, v]) => v !== "")
            .map(([k, v]) => `${k}(${v})`)
            .join(" ")
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
            id: customId || undefined,
            onclick: segment.url
              ? isWeb
                ? segment.url?.startsWith?.("javascript:")
                  ? text_attr(segment.url.replace("javascript:", ""))
                  : `location.href='${segment.url}'`
                : `execLink('${segment.url}')`
              : false,
            "data-animate":
              animateName && animateName !== "None" ? animateName : undefined,
            "data-animate-delay": animateDelay || undefined,
            "data-animate-initial-hide": animateInitialHide || undefined,
            "data-animate-duration": animateDuration || undefined,
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
            } ${setTextColor ? `color: ${textColor};` : ""}${stransform}${
              showIfFormulaInputs ? ` display: none;` : ``
            }`,
            ...(showIfFormulaInputs
              ? {
                  "data-show-if": encodeURIComponent(
                    `showIfFormulaInputs(e, '${showIfFormulaInputs.replaceAll(
                      "'",
                      "\\'"
                    )}')`
                  ),
                }
              : {}),
            ...(showIfFormulaJoinFields
              ? {
                  "data-show-if-joinfields": encodeURIComponent(
                    JSON.stringify(showIfFormulaJoinFields)
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
      if (segment.hr) return "<hr>";
      if (segment.page_break_after)
        return '<div style="break-after:page"></div>';
      return "<br />";
    }
    if (segment.type === "search_bar") {
      return `<form action="/search" method="get">${search_bar("q", "", {
        has_dropdown: segment.has_dropdown,
        autofocus: segment.autofocus,
        contents: go(segment.contents),
        hints,
      })}</form>`;
    }
    if (segment.above) {
      return segment.above
        .map((s: any, segmentIx: number) => go(s, isTop, segmentIx + ix))
        .join("");
    } else if (segment.besides) {
      const defwidth = Math.round(12 / segment.besides.length);
      //legacy, for empty (null) in the columns
      const isOneCard = (segs: any) =>
        segs.length === 1 && segs[0].type === "card";
      const onlyCard = (s: any) =>
        (s && s.type === "card") ||
        (s.above && isOneCard(s.above.filter(Boolean)));
      const cardDeck = segment.besides
        .filter(Boolean) // allow blank
        .every(onlyCard);
      let markup;

      if (cardDeck) {
        const sameWidths =
          !segment.widths || segment.widths.every((w: any) => w === defwidth);
        markup = div(
          {
            class: [
              "row",
              segment.class,
              sameWidths && `row-cols-1 row-cols-md-${segment.besides.length}`,
              typeof segment.gx !== "undefined" &&
                segment.gx !== null &&
                `gx-${segment.gx}`,
              typeof segment.gy !== "undefined" &&
                segment.gy !== null &&
                `gy-${segment.gy}`,
              !segment.style?.["margin-bottom"] && `mb-3`,
            ],
            style: segment.style,
          },
          segment.besides.map((t: any, ixb: number) => {
            if (!t) return ""; //blank col
            const newt = { ...t };
            newt.class = t.class
              ? Array.isArray(t.class)
                ? ["h-100", ...t.class]
                : t.class + " h-100"
              : "h-100";
            return div(
              {
                class: sameWidths
                  ? "col"
                  : `col-${
                      segment.breakpoint
                        ? segment.breakpoint + "-"
                        : segment.breakpoints && segment.breakpoints[ixb]
                          ? segment.breakpoints[ixb] + "-"
                          : ""
                    }${segment.widths ? segment.widths[ixb] : defwidth}`,
              },
              go(newt, false, ixb)
            );
          })
        );
      } else
        markup = div(
          {
            class: [
              "row",
              segment.class,
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
  if (instanceOWithHtmlFile(layout)) {
    const rndid = `iframe_${Math.floor(Math.random() * 16777215).toString(16)}`;
    return `${iframe({
      id: rndid,
      src: `/files/serve/${encodeURIComponent(layout.html_file)}`,
    })} ${script(`
    (() => {
      const iframe = document.getElementById("${rndid}");
      iframe.onload = () => {
        const _iframe = document.getElementById("${rndid}");
        if (_iframe.contentWindow.document.body) {
          _iframe.width = _iframe.contentWindow.document.body.scrollWidth;
          _iframe.height = _iframe.contentWindow.document.body.scrollHeight;
        }
      }
    })();
    `)}`;
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
