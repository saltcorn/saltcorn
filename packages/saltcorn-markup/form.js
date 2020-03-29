const { p, div, i, label, text, button } = require("./tags");

const isCheck = hdr => hdr.type && hdr.type.name === "Bool";
const isHoriz = formStyle => formStyle === "horiz";
const formRowWrap = (hdr, inner, error = "", fStyle) =>
  div(
    { class: `form-group ${isHoriz(fStyle) ? "row" : ""}` },
    isCheck(hdr)
      ? div(
          { class: isHoriz(fStyle) ? "col-sm-10 offset-md-2" : "" },
          div(
            { class: "form-check" },
            inner,
            label(
              { for: `input${text(hdr.name)}`, class: "form-check-label" },
              text(hdr.label)
            ),
            text(error)
          )
        )
      : [
          label(
            {
              for: `input${text(hdr.name)}`,
              class: isHoriz(fStyle) ? "col-sm-2 col-form-label" : ""
            },
            text(hdr.label)
          ),
          div({ class: isHoriz(fStyle) ? "col-sm-10" : "" }, inner, text(error))
        ],
    hdr.sublabel &&
      div(
        { class: isHoriz(fStyle) ? "col-sm-10 offset-md-2" : "" },
        i(text(hdr.sublabel))
      )
  );

const isdef = x => typeof x !== "undefined";

const select_options = (v, hdr) => {
  const selected = v ? v[hdr.name] : undefined;
  const isSelected = value =>
    !selected
      ? false
      : selected.length
      ? selected.includes(value)
      : value === selected;
  return (opts = hdr.options
    .map(o => {
      const label = typeof o === "string" ? o : o.label;
      const value = typeof o === "string" ? o : o.value;
      return `<option value="${text(value)}" ${
        isSelected(value) ? "selected" : ""
      }>${text(label)}</option>`;
    })
    .join(""));
};
const mkFormRow = (v, errors, formStyle) => hdr => {
  const validClass = errors[hdr.name] ? "is-invalid" : "";
  const errorFeedback = errors[hdr.name]
    ? `<div class="invalid-feedback">${text(errors[hdr.name])}</div>`
    : "";
  switch (hdr.input_type) {
    case "fromtype":
      return formRowWrap(
        hdr,
        hdr.type.editAs(
          hdr.name,
          v && isdef(v[hdr.name]) ? v[hdr.name] : undefined,
          hdr.attributes,
          validClass,
          hdr.required
        ),
        errorFeedback,
        formStyle
      );
    case "hidden":
      return `<input type="hidden" class="form-control ${validClass}" name="${text(
        hdr.name
      )}" ${v ? `value="${text(v[hdr.name])}"` : ""}>`;
    case "select":
      const opts = select_options(v, hdr);
      return formRowWrap(
        hdr,
        `<select class="form-control ${validClass}" name="${text(
          hdr.name
        )}" id="input${text(hdr.name)}">${opts}</select>`,
        errorFeedback,
        formStyle
      );
    case "ordered_multi_select":
      const mopts = select_options(v, hdr);
      return formRowWrap(
        hdr,
        `<select class="form-control ${validClass}" class="chosen-select" multiple name="${text(
          hdr.name
        )}" id="input${text(
          hdr.name
        )}">${mopts}</select><script>$(function(){$("#input${
          hdr.name
        }").chosen()})</script>`,
        errorFeedback,
        formStyle
      );

    default:
      return formRowWrap(
        hdr,
        `<input type="${hdr.input_type}" class="form-control" name="${
          hdr.name
        }" id="input${text(hdr.name)}" ${
          v && isdef(v[hdr.name]) ? `value="${text(v[hdr.name])}"` : ""
        }>`,
        errorFeedback,
        formStyle
      );
  }
};

const renderForm = form => {
  if (form.isStateForm) {
    form.class += " px-4 py-3";
    form.formStyle = "vert";
    var collapsedSummary = "";
    Object.entries(form.values).forEach(([k, v]) => {
      if (k[0] !== "_") collapsedSummary += `${k}:${v} `;
    });
    return div(
      { class: "dropdown" },
      button(
        {
          class: "btn btn-secondary dropdown-toggle",
          type: "button",
          id: "dropdownMenuButton",
          "data-toggle": "dropdown",
          "aria-haspopup": "true",
          "aria-expanded": "false"
        },
        collapsedSummary || "Search filter"
      ),

      div(
        { class: "dropdown-menu", "aria-labelledby": "dropdownMenuButton" },
        mkForm(form, form.errors)
      )
    );
  } else return mkForm(form, form.errors);
};

const mkForm = (form, errors = {}) => {
  const top = `<form action="${form.action}" class="${
    form.isStateForm ? "stateForm" : ""
  } ${form.class}" method="${form.methodGET ? "get" : "post"}">`;
  //console.log(hdrs);
  const flds = form.fields
    .map(mkFormRow(form.values, errors, form.formStyle))
    .join("");
  const blurbp = form.blurb ? p(text(form.blurb)) : "";
  const bot = `<div class="form-group row">
  <div class="col-sm-10">
    <button type="submit" class="btn btn-primary">${text(
      form.submitLabel || "Save"
    )}</button>
  </div>
</div>
</form>`;
  return blurbp + top + flds + bot;
};

module.exports = renderForm;
