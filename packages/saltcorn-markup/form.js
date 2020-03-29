const { p, div, i, label, text } = require("./tags");

const isCheck = hdr => hdr.type && hdr.type.name === "Bool";

const formRowWrap = (hdr, inner, error = "") =>
  div(
    { class: "form-group row" },
    isCheck(hdr)
      ? div(
          { class: "col-sm-10 offset-md-2" },
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
            { for: `input${text(hdr.name)}`, class: "col-sm-2 col-form-label" },
            text(hdr.label)
          ),
          div({ class: "col-sm-10" }, inner, text(error))
        ],
    hdr.sublabel &&
      div({ class: "col-sm-10 offset-md-2" }, i(text(hdr.sublabel)))
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
const mkFormRow = (v, errors) => hdr => {
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
        errorFeedback
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
        errorFeedback
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
        errorFeedback
      );

    default:
      return formRowWrap(
        hdr,
        `<input type="${hdr.input_type}" class="form-control" name="${
          hdr.name
        }" id="input${text(hdr.name)}" ${
          v && isdef(v[hdr.name]) ? `value="${text(v[hdr.name])}"` : ""
        }>`,
        errorFeedback
      );
  }
};

const renderForm = form =>
  mkForm(
    form.action,
    form.fields,
    form.values,
    form.submitLabel,
    form.errors,
    form.methodGET,
    form.blurb,
    form.class
  );

const mkForm = (
  action,
  hdrs,
  v,
  submitLabel = "Save",
  errors = {},
  isget,
  blurb,
  theclass
) => {
  const top = `<form action="${action}" class="${theclass}" method="${
    isget ? "get" : "post"
  }">`;
  //console.log(hdrs);
  const flds = hdrs.map(mkFormRow(v, errors)).join("");
  const blurbp = blurb ? p(text(blurb)) : "";
  const bot = `<div class="form-group row">
  <div class="col-sm-10">
    <button type="submit" class="btn btn-primary">${text(submitLabel)}</button>
  </div>
</div>
</form>`;
  return blurbp + top + flds + bot;
};

module.exports = renderForm;
