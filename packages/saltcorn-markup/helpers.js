/**
 * @category saltcorn-markup
 * @module helpers
 */

const {
  a,
  text,
  div,
  input,
  text_attr,
  ul,
  li,
  span,
  label,
} = require("./tags");

/**
 * checks if x is defined
 * @param {*} x 
 * @returns {boolean}
 */
const isdef = (x) => typeof x !== "undefined";

/**
 * @param {object|string} v 
 * @param {object} hdr 
 * @param {boolean} force_required 
 * @param {string} neutral_label 
 * @returns {string}
 */
const select_options = (v, hdr, force_required, neutral_label = "") => {
  const options0 = hdr.options || [];
  const options1 = force_required
    ? options0.filter((o) => (typeof o === "string" ? o : o.value))
    : options0;
  const options = options1.map((o) =>
    o.value === "" ? { ...o, label: neutral_label } : o
  );
  const selected = typeof v === "object" ? (v ? v[hdr.name] : undefined) : v;
  const isSelected = (value) =>
    !selected
      ? false
      : selected.length
      ? selected.includes(value)
      : value === selected;
  return options
    .map((o) => {
      const label = typeof o === "string" ? o : o.label;
      const value = typeof o === "string" ? o : o.value;
      return `<option value="${text_attr(value)}"${
        isSelected(value) ? " selected" : ""
      }>${text(label)}</option>`;
    })
    .join("");
};

/**
 * 
 * @param {object} opts
 * @param {string} opts.name
 * @param {object} [opts.options]
 * @param {string} opts.value
 * @param {object} opts.inline
 * @param {string} opts.form_name
 * @param {...*} opts.rest
 * @returns {string}
 */
const radio_group = ({ name, options, value, inline, form_name, ...rest }) =>
  div(
    (options || [])
      .filter((o) => (typeof o === "string" ? o : o.value))
      .map((o, ix) => {
        const myvalue = typeof o === "string" ? o : o.value;
        const id = `input${text_attr(name)}${ix}`;
        return div(
          { class: ["form-check", inline && "form-check-inline"] },
          input({
            class: ["form-check-input", rest.class],
            type: "radio",
            name,
            "data-fieldname": form_name,
            id,
            value: text_attr(myvalue),
            checked: myvalue === value,
          }),
          label(
            { class: "form-check-label", for: id },
            typeof o === "string" ? o : o.label
          )
        );
      })
      .join("")
  );

/**
 * @param {object} opts
 * @param {number} opts.current_page
 * @param {number} opts.pages
 * @param {function} opts.get_page_link
 * @param {boolean} opts.trailing_ellipsis
 * @returns {string}
 */
const pagination = ({
  current_page,
  pages,
  get_page_link,
  trailing_ellipsis,
}) => {
  const from = Math.max(1, current_page - 3);
  const to = Math.min(pages, current_page + 3);
  var lis = [];
  if (from > 1) {
    lis.push(
      li(
        { class: `page-item` },
        a({ class: "page-link", href: get_page_link(1) }, 1)
      )
    );
    lis.push(li({ class: `page-item` }, span({ class: "page-link" }, "...")));
  }

  for (let index = from; index <= to; index++) {
    lis.push(
      li(
        { class: ["page-item", index === current_page && "active"] },
        a({ class: "page-link", href: get_page_link(index) }, index)
      )
    );
  }
  if (to < pages) {
    lis.push(li({ class: `page-item` }, span({ class: "page-link" }, "...")));
    lis.push(
      li(
        { class: `page-item` },
        a({ class: "page-link", href: get_page_link(pages) }, pages)
      )
    );
  }
  if (trailing_ellipsis)
    lis.push(li({ class: `page-item` }, span({ class: "page-link" }, "...")));
  return ul({ class: "pagination" }, lis);
};

/**
 * @param {string} name 
 * @param {object} v 
 * @param {object} param2 
 * @returns {string}
 */
const search_bar = (
  name,
  v,
  { placeHolder, has_dropdown, contents, badges, stateField, onClick } = {}
) => {
  const rndid = Math.floor(Math.random() * 16777215).toString(16);
  const clickHandler = stateField
    ? `(function(v){v ? set_state_field('${stateField}', v):unset_state_field('${stateField}');})($('input.search-bar').val())`
    : onClick || "";
  return `<div class="input-group search-bar">
  <div class="input-group-prepend">
  <button class="btn btn-outline-secondary search-bar" ${
    clickHandler ? `onClick="${clickHandler}"` : ""
  } type="submit" id="button-search-submit">
  <i class="fas fa-search"></i>
  </button>
  </div>
<input type="search" class="form-control search-bar ${
    (badges && badges.length > 0) || has_dropdown ? "br-none" : ""
  }" placeholder="${placeHolder || "Search for..."}" 
}" 
  }" 
       id="input${text_attr(name)}" name="${name}" 
       ${
         clickHandler
           ? `onsearch="${clickHandler}" onChange="${clickHandler}"`
           : ""
       }
       aria-label="Search" aria-describedby="button-search-submit" ${
         v ? `value="${text_attr(v)}"` : ""
       }>
<div class="input-group-append">
  ${
    badges && badges.length > 0
      ? `<div class="input-group-text">${badges
          .map(
            (b) =>
              `<span class="badge badge-primary">${b.text}${
                b.onclick
                  ? `<a href="javascript:${b.onclick}"><i class="ml-1 fas fa-lg fa-times"></i></a> `
                  : ""
              }</span>`
          )
          .join("&nbsp;")}
  </div>`
      : ""
  }
  ${
    has_dropdown
      ? `<button class="btn btn-outline-secondary dropdown-toggle search-bar" id="dd${rndid}" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" onclick="align_dropdown('${rndid}')"></button>`
      : ""
  }
  ${
    has_dropdown
      ? `<div class="dropdown-menu search-bar p-2" id="dm${rndid}" aria-labelledby="dd${rndid}">
      ${contents}
      </div>`
      : ""
  }
</div>
</div>`;
};

module.exports = {
  isdef,
  select_options,
  search_bar,
  pagination,
  radio_group,
};
