const { a, text, div, input, text_attr } = require("./tags");

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

const search_bar = (name, v) => `<div class="input-group">
<input type="text" class="form-control bg-light" placeholder="Search for..." 
       id="input${text_attr(name)}" name="${name}" 
       aria-label="Search" aria-describedby="button-search-submit" ${
         v ? `value="${text_attr(v)}"` : ""
       }>
<div class="input-group-append">
  <button class="btn btn-primary" type="submit" id="button-search-submit">
  <i class="fas fa-search"></i>
  </button>
</div>
</div>`;

const search_bar_form = () => `<form action="/search" method="get">
${search_bar("q")}
</form>`;

module.exports = { isdef, select_options, search_bar, search_bar_form };
