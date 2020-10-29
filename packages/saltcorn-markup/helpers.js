const { a, text, div, input, text_attr, ul, li, span } = require("./tags");

const isdef = (x) => typeof x !== "undefined";

const select_options = (v, hdr) => {
  const selected = v ? v[hdr.name] : undefined;
  const isSelected = (value) =>
    !selected
      ? false
      : selected.length
      ? selected.includes(value)
      : value === selected;
  return (opts = (hdr.options || [])
    .map((o) => {
      const label = typeof o === "string" ? o : o.label;
      const value = typeof o === "string" ? o : o.value;
      return `<option value="${text_attr(value)}" ${
        isSelected(value) ? "selected" : ""
      }>${text(label)}</option>`;
    })
    .join(""));
};

const pagination = ({ current_page, pages, get_page_link }) => {
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
  return ul({ class: "pagination" }, lis);
};

const search_bar = (
  name,
  v,
  { onClick, placeHolder } = {}
) => `<div class="input-group">
<input type="text" class="form-control bg-light search-bar" placeholder="${
  placeHolder || "Search for..."
}" 
       id="input${text_attr(name)}" name="${name}" 
       ${onClick ? `onChange="${onClick}"` : ""}
       aria-label="Search" aria-describedby="button-search-submit" ${
         v ? `value="${text_attr(v)}"` : ""
       }>
<div class="input-group-append">
  <button class="btn btn-primary" ${
    onClick ? `onClick="${onClick}"` : ""
  } btype="submit" id="button-search-submit">
  <i class="fas fa-search"></i>
  </button>
</div>
</div>`;

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
