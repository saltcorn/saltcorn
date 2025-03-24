/**
 * @category saltcorn-markup
 * @module helpers
 */

import tags = require("./tags");
const { a, text, div, input, text_attr, ul, li, span, label, i, button } = tags;

/**
 * checks if x is defined
 * @param {any} x
 * @returns {boolean}
 */
const isdef = (x: any): boolean => typeof x !== "undefined";

/**
 * @param {object|string} v
 * @param {object} hdr
 * @param {boolean} force_required
 * @param {string} neutral_label
 * @returns {string}
 */
const select_options = (
  v: string | any,
  hdr: any,
  force_required?: boolean,
  neutral_label: string = "",
  sort: boolean = true
): string => {
  const options0 = hdr.options || [];
  const options1 = force_required
    ? options0.filter((o: any) => (typeof o === "string" ? o : o.value))
    : options0;
  let options = options1.map((o: any) => ({
    label: typeof o === "string" ? o : o.label,
    value: typeof o === "string" ? o : o.value,
  }));
  if (sort)
    options.sort((a: any, b: any) =>
      (a.label?.toLowerCase?.() || a.label) >
      (b.label?.toLowerCase?.() || b.label)
        ? 1
        : -1
    );
  options = options.map((o: any) =>
    o.value === "" ? { ...o, label: neutral_label || o.label } : o
  );
  const selected = typeof v === "object" ? (v ? v[hdr.name] : undefined) : v;
  const isSelected = (value: any) =>
    !selected
      ? false
      : Array.isArray(selected)
        ? selected.includes(value)
        : `${value}` === `${selected}`;

  return options
    .map((o: any) => {
      const label = o.label;
      const value = o.value;
      return `<option value="${text_attr(value)}"${
        isSelected(value) ? " selected" : ""
      }>${text(label)}</option>`;
    })
    .join("");
};

// declaration merging
namespace HelpersExports {
  export type RadioGroupOpts = {
    name: string;
    options: any;
    value: string;
    inline: any;
    form_name: string;
    onChange: any;
    [key: string]: any; // "...rest" properties
  };
}
type RadioGroupOpts = HelpersExports.RadioGroupOpts;

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
const radio_group = ({
  name,
  options,
  value,
  inline,
  form_name,
  onChange,
  required,
  ...rest
}: RadioGroupOpts): string =>
  div(
    (options || [])
      .filter((o: any) => (typeof o === "string" ? o : o.value))
      .map((o: any, ix: number) => {
        const myvalue = typeof o === "string" ? o : o.value;
        const id = `input${text_attr(name)}${ix}`;
        return div(
          { class: ["form-check", inline && "form-check-inline"] },
          input({
            class: ["form-check-input", rest.class],
            type: "radio",
            name,
            onChange,
            required: !!required,
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

// declaration merging
namespace HelpersExports {
  export type CheckBoxGroupOpts = {
    name: string;
    options: any;
    value: string;
    inline: boolean;
    form_name: string;
    onChange: any;
    [key: string]: any; // "...rest" properties
  };
}
type CheckBoxGroupOpts = HelpersExports.CheckBoxGroupOpts;

const checkbox_group = ({
  name,
  options,
  value,
  inline,
  form_name,
  onChange,
  ...rest
}: CheckBoxGroupOpts): string =>
  div(
    (options || [])
      .filter((o: any) => (typeof o === "string" ? o : o.value))
      .map((o: any, ix: number) => {
        const myvalue = typeof o === "string" ? o : o.value;
        const id = `input${text_attr(name)}${ix}`;
        return div(
          { class: ["form-check", inline && "form-check-inline"] },
          input({
            class: ["form-check-input", rest.class],
            type: "checkbox",
            name,
            onChange: `check_state_field(this)`,
            "data-fieldname": form_name,
            id,
            value: text_attr(myvalue),
            checked: Array.isArray(value)
              ? value.includes(myvalue)
              : myvalue === value,
          }),
          label(
            { class: "form-check-label", for: id },
            typeof o === "string" ? o : o.label
          )
        );
      })
      .join("")
  );

// declaration merging
namespace HelpersExports {
  export type PaginationOpts = {
    current_page: number;
    pages: number;
    get_page_link: (index: number) => string;
    trailing_ellipsis?: boolean;
  };
}
type PaginationOpts = HelpersExports.PaginationOpts;

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
}: PaginationOpts): string => {
  const from = Math.max(1, current_page - 3);
  const to = Math.min(pages, current_page + 3);
  var lis = [];
  if (from > 1) {
    lis.push(
      li(
        { class: `page-item` },
        span(
          {
            class: "page-link link-style",
            onclick: get_page_link(1),
            role: "link",
          },
          1
        )
      )
    );
    lis.push(li({ class: `page-item` }, span({ class: "page-link" }, "...")));
  }

  for (let index = from; index <= to; index++) {
    lis.push(
      li(
        { class: ["page-item", index === current_page && "active"] },
        span(
          {
            class: "page-link link-style",
            onclick: get_page_link(index),
            role: "link",
          },
          index
        )
      )
    );
  }
  if (to < pages) {
    lis.push(li({ class: `page-item` }, span({ class: "page-link" }, "...")));
    lis.push(
      li(
        { class: `page-item` },
        span(
          {
            class: "page-link link-style",
            onclick: get_page_link(pages),
            role: "link",
          },
          pages
        )
      )
    );
  }
  if (trailing_ellipsis)
    lis.push(li({ class: `page-item` }, span({ class: "page-link" }, "...")));
  return ul({ class: "pagination" }, lis);
};

// declaration merging
namespace HelpersExports {
  export type SearchBarOpts = {
    placeHolder?: string;
    has_dropdown: boolean;
    autofocus?: boolean;
    contents: string;
    badges?: string[];
    stateField: string;
    onClick: any;
    hints?: any;
  };
}
type SearchBarOpts = HelpersExports.SearchBarOpts;

/**
 * @param {string} name
 * @param {object} v
 * @param {object} param2
 * @returns {string}
 */
const search_bar = (
  name: string,
  v: any,
  {
    placeHolder,
    has_dropdown,
    contents,
    badges,
    stateField,
    onClick,
    autofocus,
    hints,
  }: SearchBarOpts | any = {}
): string => {
  const rndid = Math.floor(Math.random() * 16777215).toString(16);
  const input_id = `input${text_attr(name)}_${rndid}`;
  const clickHandler = stateField
    ? `(function(v, that){v ? set_state_field('${stateField}', v, that):unset_state_field('${stateField}', that);})($('#${input_id}').val(), this)`
    : onClick || "";
  return `<div class="${
    hints?.searchBar?.iconButton === false ? "" : "input-group"
  }${
    hints?.searchBar?.containerClass
      ? ` ${hints?.searchBar?.containerClass}`
      : ""
  } search-bar" id="search-input-group-${rndid}">
  ${
    hints?.searchBar?.iconButton === false
      ? i({ class: ["fas fa-search", hints?.searchBar?.iconClass] })
      : `<button class="btn btn-outline-secondary search-bar" ${
          clickHandler ? `onClick="${clickHandler}"` : ""
        } type="submit" id="button-search-submit">
  <i class="fas fa-search"></i>
  </button>`
  }
<input type="search" class="form-control search-bar ${
    (badges && badges.length > 0) || has_dropdown ? "br-none" : ""
  }${hints?.searchBar?.inputClass ? ` ${hints?.searchBar?.inputClass}` : ""}" ${
    autofocus ? `autofocus ` : ""
  }placeholder="${placeHolder || "Search for..."}" 
}" 
  }" 
       id="${input_id}" name="${name}" 
       ${
         clickHandler
           ? `onsearch="${clickHandler}" onChange="${clickHandler}"`
           : ""
       }
       aria-label="Search" aria-describedby="button-search-submit" ${
         v ? `value="${text_attr(v)}"` : ""
       }>
  ${
    badges && badges.length > 0
      ? `<div class="input-group-text">${badges
          .map(
            (b: any) =>
              `<span class="badge bg-primary">${b.text}${
                b.onclick
                  ? `<a href="javascript:${b.onclick}"><i class="ms-1 fas fa-lg fa-times"></i></a> `
                  : ""
              }</span>`
          )
          .join("&nbsp;")}
  </div>`
      : ""
  }
  ${
    has_dropdown
      ? `<button class="btn btn-outline-secondary dropdown-toggle search-bar" id="dd${rndid}" type="button" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" onclick="align_dropdown('${rndid}')"></button>`
      : ""
  }
  ${
    has_dropdown
      ? `<div class="dropdown-menu search-bar p-2" id="dm${rndid}" aria-labelledby="dd${rndid}">
      ${contents}
      </div>`
      : ""
  }
</div>`;
};

const dropdown_checkboxes = ({
  btnClass,
  btnLabel,
  items = [],
  checked = {},
  onChange,
}: {
  btnClass: string;
  btnLabel: string;
  items: Array<{ label: string; value: string } | string>;
  checked: Record<string, boolean>;
  onChange?: string;
}) =>
  div(
    { class: "dropdown" },
    button(
      {
        class: `btn ${btnClass || "btn-primary"} dropdown-toggle`,
        type: "button",
        id: "multiSelectDropdown",
        "data-bs-toggle": "dropdown",
        "aria-expanded": "false",
      },
      btnLabel
    ),
    ul(
      { class: "dropdown-menu", "aria-labelledby": "multiSelectDropdown" },
      items.map((item) =>
        li(
          { class: "dropdown-item" },
          div(
            { class: "form-check" },
            input({
              class: "form-check-input",
              type: "checkbox",
              value: typeof item === "string" ? item : item.value,
              checked: checked[typeof item === "string" ? item : item.value],
              onChange,
            }),
            label(
              { class: "form-check-label" },
              typeof item === "string" ? item : item.label
            )
          )
        )
      )
    )
  );

const HelpersExports = {
  isdef,
  select_options,
  search_bar,
  pagination,
  radio_group,
  checkbox_group,
  dropdown_checkboxes,
};
export = HelpersExports;
