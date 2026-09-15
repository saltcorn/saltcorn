/**
 * This is the saltcorn-markup package
 * @module
 */
import renderFormModule from "./form.js";
const { renderForm, mkFormContentNoLayout, mkForm, renderFormLayout } =
  renderFormModule;
import renderBuilder from "./builder.js";
import renderWorkflow from "./workflow.js";
import mkTable from "./table.js";
import tabs from "./tabs.js";
import tags from "./tags.js";
import helpers from "./helpers.js";
const { a, text, div, button, hr, time, i, input, text_attr, span } = tags;
import layoutUtils from "./layout_utils.js";
import { Req } from "@saltcorn/types/base_types";
const { alert, toast, show_icon_and_label } = layoutUtils;

/**
 * @param {string} href
 * @param {string} s
 * @returns {string}
 */
const link = (href: string, s: string, attributes: any = {}): string =>
  a({ href: text(href), ...attributes }, text(s));

type PostBtnOpts = {
  btnClass: string;
  onClick?: string;
  small?: boolean;
  style?: string;
  ajax?: boolean;
  reload_on_done: string;
  reload_delay?: string;
  klass: string;
  formClass?: string;
  spinner?: boolean;
  req: Req;
  confirm?: boolean;
  icon?: string;
  title?: string;
};

declare let window: any;

const buildButtonCallback = (
  href: string,
  ajax: boolean | undefined,
  reload_on_done: boolean,
  reload_delay: number | undefined,
  csrfToken: string
): string => {
  const isNode = typeof window === "undefined";
  // href/csrf are literals here, not looked up via closest("form")
  if (!isNode) return `local_post_btn('${href}')`; // mobile: app's own navigation
  if (ajax)
    return `ajax_post_btn('${href}', ${reload_on_done}, ${reload_delay}, '${csrfToken}')`;
  return `native_post_btn('${href}', 'post', '${csrfToken}')`;
};

/**
 * @param href
 * @param s
 * @param csrfToken
 * @param opts
 * @param opts.btnClass
 * @param opts.onClick
 * @param opts.small
 * @param opts.style
 * @param opts.ajax
 * @param opts.reload_on_done
 * @param opts.reload_delay
 * @param opts.klass
 * @param opts.formClass
 * @param opts.spinner
 * @param opts.req
 * @param opts.confirm
 * @param opts.icon
 * @returns
 */
const post_btn = (
  href: string,
  s: string,
  csrfToken: string,
  {
    btnClass = "btn-primary",
    onClick,
    small,
    style,
    ajax,
    reload_on_done,
    reload_delay,
    klass = "",
    formClass,
    spinner,
    req,
    confirm,
    icon,
    title,
    body,
  }: PostBtnOpts | any = {}
): string => {
  const bodyQuery = body
    ? Object.entries(body)
        .map(
          ([k, v]: any) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
        )
        .join("&")
    : "";
  const targetHref = bodyQuery
    ? `${href}${href.includes("?") ? "&" : "?"}${bodyQuery}`
    : href;

  // ajax and native submit both fire from onclick, so no <form> is needed
  const jsCall = buildButtonCallback(
    targetHref,
    ajax,
    reload_on_done,
    reload_delay,
    csrfToken
  );
  const onclick = confirm
    ? `if(confirm('${req.__("Are you sure?")}')) {${
        spinner ? "spin_action_link(this);" : ""
      }${onClick ? `${onClick};` : ""}${jsCall}}`
    : `${spinner ? "spin_action_link(this);" : ""}${
        onClick ? `${onClick};` : ""
      }${jsCall}`;

  const btn = button(
    {
      type: "button",
      onclick,
      class: `${klass} btn ${small ? "btn-sm" : ""} ${btnClass} d-inline-block`,
      ...(style ? { style } : {}),
      ...(title ? { title: text_attr(title) } : {}),
    },
    show_icon_and_label(icon, s)
  );

  return formClass ? span({ class: formClass }, btn) : btn;
};

/**
 * UI Form for Delete Item confirmation
 * @param href - href
 * @param req - Request
 * @param what- Item
 * @returns return html form
 */
const post_delete_btn = (href: string, req: Req, what?: string): string =>
  button(
    {
      type: "button",
      class: "btn btn-danger btn-sm",
      onclick: `if(confirm('${
        what
          ? req.__("Are you sure you want to delete %s?", what)
          : req.__("Are you sure?")
      }')) native_post_btn('${href}', 'post', '${req.csrfToken()}')`,
    },
    i({ class: "fas fa-trash-alt" })
  );

/**
 * @param href
 * @param s
 * @param req
 * @param confirm
 * @param what
 * @returns
 */
const post_dropdown_item = (
  href: string,
  s: string,
  req: Req,
  confirm?: boolean,
  what?: string
): string => {
  const confirmationScript = confirm
    ? `if(confirm('${
        what
          ? req.__("Are you sure you want to delete %s?", what)
          : req.__("Are you sure?")
      }')) `
    : "";

  // native_post_btn builds its own <form>, no per-item <form id="..."> needed
  return a(
    {
      class: "dropdown-item",
      onclick: `${confirmationScript}native_post_btn('${href}', 'post', '${req.csrfToken()}')`,
    },
    s
  );
};

/**
 * @param id
 * @param elems
 * @returns
 */
const settingsDropdown = (id: string, elems: any): string =>
  div(
    { class: "dropdown" },
    button(
      {
        class: "btn btn-sm btn-outline-secondary",
        "data-boundary": "viewport",
        type: "button",
        id,
        "data-bs-toggle": "dropdown",
        "aria-haspopup": "true",
        "aria-expanded": "false",
      },
      i({ class: "fas fa-ellipsis-h" })
    ),
    div(
      {
        class: "dropdown-menu dropdown-menu-end",
        "aria-labelledby": id,
      },
      elems
    )
  );

/**
 * @param date
 * @param options
 * @returns
 */
const localeTime = (
  date: Date,
  options: any = { hour: "2-digit", minute: "2-digit" },
  locale: string = "en"
): string =>
  date
    ? time(
        {
          datetime: date.toISOString(),
          "locale-time-options": encodeURIComponent(JSON.stringify(options)),
        },
        date.toLocaleTimeString(locale || "en", options)
      )
    : "";

/**
 * @param date
 * @param options
 * @returns
 */
const localeDateTime = (
  date: Date,
  options: any = {},
  locale: string = "en"
): string =>
  date?.toISOString
    ? time(
        {
          datetime: date.toISOString(),
          "locale-options": encodeURIComponent(JSON.stringify(options)),
        },
        date.toLocaleString(locale || "en", options)
      )
    : "";

/**
 * @param date
 * @param options
 * @returns
 */
const localeDate = (
  date: Date,
  options: any = {},
  locale: string = "en"
): string =>
  date
    ? time(
        {
          datetime: date.toISOString(),
          "locale-date-options": encodeURIComponent(JSON.stringify(options)),
        },
        date.toLocaleDateString(locale || "en", options)
      )
    : "";

const badge = (col: string, lbl: string): string =>
  `${span({ class: `badge bg-${col}` }, lbl)}&nbsp;`;

export {
  mkTable,
  badge,
  renderForm,
  mkFormContentNoLayout,
  mkForm,
  renderFormLayout,
  renderWorkflow,
  settingsDropdown,
  renderBuilder,
  link,
  post_btn,
  post_delete_btn,
  post_dropdown_item,
  tabs,
  localeTime,
  localeDate,
  localeDateTime,
  div,
  a,
  i,
  button,
  input,
  hr,
  tags,
  alert,
  toast,
  helpers,
};
export default {
  mkTable,
  badge,
  renderForm,
  mkFormContentNoLayout,
  mkForm,
  renderFormLayout,
  renderWorkflow,
  settingsDropdown,
  renderBuilder,
  link,
  post_btn,
  post_delete_btn,
  post_dropdown_item,
  tabs,
  localeTime,
  localeDate,
  localeDateTime,
  div,
  a,
  i,
  button,
  input,
  hr,
  tags,
  alert,
  toast,
  helpers,
};
