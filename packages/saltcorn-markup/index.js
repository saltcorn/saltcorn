const renderForm = require("./form");
const renderBuilder = require("./builder");
const mkTable = require("./table");
const tabs = require("./tabs");
const { a, text, div, button, time } = require("./tags");

const link = (href, s) => a({ href: text(href) }, text(s));

const post_btn = (
  href,
  s,
  csrfToken,
  {
    btnClass = "btn-primary",
    onClick,
    small,
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
  } class="${klass} btn ${small ? "btn-sm" : ""} ${btnClass}">${
    icon ? `<i class="${icon}"></i>&nbsp;` : ""
  }${s}</button></form>`;
/**
 * UI Form for Delete Item confirmation
 * @param href - href
 * @param req - Request
 * @param what - Item
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

const localeHourMinute = (
  date,
  options = { hour: "2-digit", minute: "2-digit" }
) =>
  time(
    {
      datetime: date.toISOString(),
      "locale-time-options": encodeURIComponent( JSON.stringify(options)),
    },
    date.toLocaleTimeString("en", options)
  );

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
  localeHourMinute,
  localeDate,
};
