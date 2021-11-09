/**
 * @category saltcorn-markup
 * @module saltcorn-markup/index
 */
const renderForm = require("./form");
const renderBuilder = require("./builder");
const mkTable = require("./table");
const tabs = require("./tabs");
const { a, text, div, button, time } = require("./tags");

/**
 * @param {string} href 
 * @param {string} s 
 * @returns {string}
 */
const link = (href, s) => a({ href: text(href) }, text(s));

/**
 * @param {string} href 
 * @param {string} s 
 * @param {string} csrfToken 
 * @param {object} opts
 * @param {string} [opts.btnClass = "btn-primary"]
 * @param {string} [opts.onClick]
 * @param {string} [opts.small]
 * @param {string} [opts.style]
 * @param {*} opts.ajax
 * @param {string} opts.reload_on_done
 * @param {string} opts.reload_delay
 * @param {string} [opts.klass = "btn-primary"]
 * @param {string} [opts.formClass]
 * @param {string} opts.spinner
 * @param {object} opts.req
 * @param {boolean} opts.confirm
 * @param {string} opts.icon
 * @returns {string}
 */
const post_btn = (
  href,
  s,
  csrfToken,
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
  } = {}
) =>
  `<form action="${text(href)}" method="post"${
    formClass ? `class="${formClass}"` : ""
  }>
  <input type="hidden" name="_csrf" value="${csrfToken}">
<button ${ajax ? 'type="button"' : 'type="submit"'} ${
    onClick
      ? `onclick="${spinner ? "press_store_button(this);" : ""}${onClick}"`
      : ajax && confirm
      ? `onclick="if(confirm('${req.__("Are you sure?")}')) {${
          spinner ? "press_store_button(this);" : ""
        }ajax_post_btn(this, ${reload_on_done}, ${reload_delay})}"`
      : ajax
      ? `onclick="${
          spinner ? "press_store_button(this);" : ""
        }ajax_post_btn(this, ${reload_on_done}, ${reload_delay})"`
      : confirm
      ? `onclick="return confirm('${req.__("Are you sure?")}')"`
      : ""
  } class="${klass} btn ${small ? "btn-sm" : ""} ${btnClass}"${
    style ? ` style="${style}"` : ""
  }>${icon ? `<i class="${icon}"></i>&nbsp;` : ""}${s}</button></form>`;

  /**
 * UI Form for Delete Item confirmation
 * @param {string} href - href
 * @param {string} req - Request
 * @param {string} what - Item
 * @returns {string} return html form
 */
const post_delete_btn = (href, req, what) =>
  `<form action="${text(href)}" method="post" >
    <input type="hidden" name="_csrf" value="${req.csrfToken()}">
    <button type="submit" class="btn btn-danger btn-sm" 
      onclick="return confirm('${
        what
          ? req.__("Are you sure you want to delete %s?", what)
          : req.__("Are you sure?")
      }')" />
      <i class="fas fa-trash-alt"></i>
    </button>
  </form>`;

/**
 * @param {string} href 
 * @param {string} s 
 * @param {object} req 
 * @param {boolean} confirm 
 * @param {string} what 
 * @returns {string}
 */
const post_dropdown_item = (href, s, req, confirm, what) => {
  const id = href.split("/").join("");
  return `<a class="dropdown-item" onclick="${
    confirm
      ? `if(confirm('${
          what
            ? req.__("Are you sure you want to delete %s?", what)
            : req.__("Are you sure?")
        }')) `
      : ""
  }$('#${id}').submit()">${s}</a>
  <form id="${id}" action="${text(href)}" method="post">
    <input type="hidden" name="_csrf" value="${req.csrfToken()}">
  </form>`;
};

/**
 * @param {string} id 
 * @param {*} elems 
 * @returns {div}
 */
const settingsDropdown = (id, elems) =>
  div(
    { class: "dropdown" },
    button(
      {
        class: "btn btn-sm btn-outline-secondary",
        "data-boundary": "viewport",
        type: "button",
        id,
        "data-toggle": "dropdown",
        "aria-haspopup": "true",
        "aria-expanded": "false",
      },
      '<i class="fas fa-ellipsis-h"></i>'
    ),
    div(
      {
        class: "dropdown-menu dropdown-menu-right",
        "aria-labelledby": id,
      },
      elems
    )
  );

/**
 * @param {Date} date 
 * @param {object} opts
 * @param {string} [opts.hour = "2-digit"]
 * @param {string} [opts.minute = "2-digit"]
 * @returns {string}
 */
const localeTime = (date, options = { hour: "2-digit", minute: "2-digit" }) =>
  time(
    {
      datetime: date.toISOString(),
      "locale-time-options": encodeURIComponent(JSON.stringify(options)),
    },
    date.toLocaleTimeString("en", options)
  );

/**
 * @param {Date} date 
 * @param {object} [options ={}]
 * @returns {string}
 */  
const localeDateTime = (date, options = {}) =>
  time(
    {
      datetime: date.toISOString(),
      "locale-options": encodeURIComponent(JSON.stringify(options)),
    },
    date.toLocaleString("en", options)
  );

/**
 * @param {Date} date 
 * @param {object} [options = {}]
 * @returns {string}
 */
const localeDate = (date, options = {}) =>
  time(
    {
      datetime: date.toISOString(),
      "locale-date-options": encodeURIComponent(JSON.stringify(options)),
    },
    date.toLocaleDateString("en", options)
  );

module.exports = {
  mkTable,
  renderForm,
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
};
