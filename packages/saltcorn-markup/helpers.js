const { a, text, div, input, text_attr, ul, li, span } = require("./tags");

const isdef = (x) => typeof x !== "undefined";

const select_options = (v, hdr, force_required, neutral_label = "") => {
  const options0 = hdr.options || [];
  const options1 = force_required
    ? options0.filter((o) => (typeof o === "string" ? o : o.value))
    : options0;
  const options = options1.map((o) =>
    o.value === "" ? { ...o, label: neutral_label } : o
  );
  const selected = v ? v[hdr.name] : undefined;
  const isSelected = (value) =>
    !selected
      ? false
      : selected.length
      ? selected.includes(value)
      : value === selected;
  return options.map((o) => {
    const label = typeof o === "string" ? o : o.label;
    const value = typeof o === "string" ? o : o.value;
    return `<option value="${text_attr(value)}" ${
      isSelected(value) ? "selected" : ""
    }>${text(label)}</option>`;
  }).join("");
};

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

const search_bar_form = () => `<form action="/search" method="get">
${search_bar("q")}
</form>`;

module.exports = {
  isdef,
  select_options,
  search_bar,
  search_bar_form,
  pagination,
};
