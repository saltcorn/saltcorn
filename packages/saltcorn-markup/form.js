const { p, div, i, label, text, text_attr, button, a, span } = require("./tags");
const { contract, is } = require("contractis");

const mkShowIf = sIf =>
  Object.entries(sIf)
    .map(
      ([target, value]) =>
        `e.closest('.form-namespace').find('${target}').val()==='${value}'`
    )
    .join(" && ");

const isCheck = hdr => hdr.type && hdr.type.name === "Bool";
const isHoriz = formStyle => formStyle === "horiz";
const formRowWrap = (hdr, inner, error = "", fStyle, labelCols) =>
  div(
    {
      class: ["form-group", isHoriz(fStyle) && "row"],
      ...(hdr.showIf && {
        "data-show-if": mkShowIf(hdr.showIf)
      })
    },
    isCheck(hdr)
      ? div(
          {
            class:
              isHoriz(fStyle) &&
              `col-sm-${12 - labelCols} offset-md-${labelCols}`
          },
          div(
            { class: "form-check" },
            inner,
            label(
              { for: `input${text_attr(hdr.name)}`, class: "form-check-label" },
              text(hdr.label)
            ),
            text(error)
          )
        )
      : [
          label(
            {
              for: `input${text_attr(hdr.name)}`,
              class: isHoriz(fStyle) && `col-sm-${labelCols} col-form-label`
            },
            text(hdr.label)
          ),
          div(
            { class: isHoriz(fStyle) && `col-sm-${12 - labelCols}` },
            inner,
            text(error)
          )
        ],
    hdr.sublabel &&
      div(
        {
          class:
            isHoriz(fStyle) && `col-sm-${12 - labelCols} offset-md-${labelCols}`
        },
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
      return `<option value="${text_attr(value)}" ${
        isSelected(value) ? "selected" : ""
      }>${text(label)}</option>`;
    })
    .join(""));
};

const mkFormRow = (v, errors, formStyle, labelCols) => hdr =>
  hdr.isRepeat
    ? mkFormRowForRepeat(v, errors, formStyle, labelCols, hdr)
    : mkFormRowForField(v, errors, formStyle, labelCols)(hdr);

const mkFormRowForRepeat = (v, errors, formStyle, labelCols, hdr) => {
  const adder = a({ href: `javascript:add_repeater('${hdr.name}')` }, "Add");
  const icons = div(
    { class: "float-right" },
    span(
      { onclick: "rep_up(this)" },
      i({ class: "fa fa-arrow-up pull-right" })
    ),
    "&nbsp;",
    span({ onclick: "rep_del(this)" }, i({ class: "fa fa-times pull-right" })),
    "&nbsp;",
    span(
      { onclick: "rep_down(this)" },
      i({ class: "fa fa-arrow-down pull-right" })
    )
  );
  if (Array.isArray(v[hdr.name]) && v[hdr.name].length > 0) {
    return (
      div(
        { class: `repeats-${hdr.name}` },
        v[hdr.name].map((vi, ix) => {
          return div(
            { class: `form-repeat form-namespace repeat-${hdr.name}` },
            icons,
            hdr.fields.map(f => {
              return mkFormRowForField(
                vi,
                errors,
                formStyle,
                labelCols,
                "_" + ix
              )(f);
            })
          );
        })
      ) + adder
    );
  } else {
    return (
      div(
        { class: `repeats-${hdr.name}` },
        div(
          { class: `form-repeat form-namespace repeat-${hdr.name}` },
          icons,
          hdr.fields.map(f => {
            return mkFormRowForField(v, errors, formStyle, labelCols, "_0")(f);
          })
        )
      ) + adder
    );
  }
};

const displayEdit = (hdr, name, v, extracls) => {
  var fieldview;
  if (hdr.fieldview && hdr.type.fieldviews[hdr.fieldview])
    fieldview = hdr.type.fieldviews[hdr.fieldview];
  else {
    //first isedit fieldview
    fieldview = Object.entries(hdr.type.fieldviews).find(
      ([nm, fv]) => fv.isEdit
    )[1];
  }
  return fieldview.run(
    name,
    v,
    hdr.attributes,
    extracls + " " + hdr.class,
    hdr.required
  );
};

const mkFormRowForField = (
  v,
  errors,
  formStyle,
  labelCols,
  nameAdd = ""
) => hdr => {
  const name = hdr.name + nameAdd;
  const validClass = errors[name] ? "is-invalid" : "";
  const errorFeedback = errors[name]
    ? `<div class="invalid-feedback">${text(errors[name])}</div>`
    : "";
  switch (hdr.input_type) {
    case "fromtype":
      return formRowWrap(
        hdr,
        displayEdit(
          hdr,
          name,
          v && isdef(v[hdr.name]) ? v[hdr.name] : hdr.default,
          validClass
        ),
        errorFeedback,
        formStyle,
        labelCols
      );
    case "hidden":
      return `<input type="hidden" class="form-control ${validClass} ${
        hdr.class
      }" name="${text_attr(name)}" ${v ? `value="${text_attr(v[hdr.name])}"` : ""}>`;
    case "select":
      const opts = select_options(v, hdr);
      return formRowWrap(
        hdr,
        `<select class="form-control ${validClass} ${hdr.class}" name="${text_attr(
          name
        )}" id="input${text_attr(name)}">${opts}</select>`,
        errorFeedback,
        formStyle,
        labelCols
      );
    case "file":
      return formRowWrap(
        hdr,
        `${
          v[hdr.name] ? text(v[hdr.name]) : ""
        }<input type="file" class="form-control-file ${validClass} ${
          hdr.class
        }" name="${text_attr(name)}" id="input${text_attr(name)}">`,
        errorFeedback,
        formStyle,
        labelCols
      );
    case "ordered_multi_select":
      const mopts = select_options(v, hdr);
      return formRowWrap(
        hdr,
        `<select class="form-control ${validClass} ${
          hdr.class
        }" class="chosen-select" multiple name="${text_attr(name)}" id="input${text_attr(
          name
        )}">${mopts}</select><script>$(function(){$("#input${name}").chosen()})</script>`,
        errorFeedback,
        formStyle,
        labelCols
      );

    default:
      const the_input = `<input type="${hdr.input_type}" class="form-control ${
        hdr.class
      }" name="${name}" id="input${text_attr(name)}" ${
        v && isdef(v[hdr.name]) ? `value="${text_attr(v[hdr.name])}"` : ""
      }>`;
      const inner = hdr.postText
        ? div(
            { class: "input-group" },
            the_input,
            div(
              { class: "input-group-append" },
              span(
                { class: "input-group-text", id: "basic-addon2" },
                hdr.postText
              )
            )
          )
        : the_input;
      return formRowWrap(hdr, inner, errorFeedback, formStyle, labelCols);
  }
};

const renderForm = form => {
  if (form.isStateForm) {
    form.class += " px-4 py-3";
    form.formStyle = "vert";
    var collapsedSummary = "";
    Object.entries(form.values).forEach(([k, v]) => {
      if (k[0] !== "_") collapsedSummary += `${text(k)}:${text(v)} `;
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
  const hasFile = form.fields.some(f => f.input_type === "file");
  const top = `<form action="${form.action}" class="form-namespace ${
    form.isStateForm ? "stateForm" : ""
  } ${form.class}" method="${form.methodGET ? "get" : "post"}" ${
    hasFile ? 'encType="multipart/form-data"' : ""
  }>`;
  //console.log(hdrs);
  const flds = form.fields
    .map(mkFormRow(form.values, errors, form.formStyle, form.labelCols || 2))
    .join("");
  const blurbp = form.blurb ? p(text(form.blurb)) : "";
  const bot = `<div class="form-group row">
  <div class="col-sm-12">
    <button type="submit" class="btn btn-primary">${text(
      form.submitLabel || "Save"
    )}</button>
  </div>
</div>
</form>`;
  return blurbp + top + flds + bot;
};

module.exports = contract(is.fun(is.class("Form"), is.str), renderForm);
