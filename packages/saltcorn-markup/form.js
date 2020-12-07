const {
  p,
  div,
  i,
  label,
  text,
  text_attr,
  button,
  a,
  h5,
  span,
  escapeHTML,
} = require("./tags");
const { contract, is } = require("contractis");
const renderLayout = require("./layout");
const { isdef, select_options, search_bar } = require("./helpers");
const mkShowIf = (sIf) =>
  Object.entries(sIf)
    .map(([target, value]) =>
      typeof value === "boolean"
        ? `e.closest('.form-namespace').find('${target}').prop('checked')===${JSON.stringify(
            value
          )}`
        : Array.isArray(value)
        ? `[${value
            .map((v) => `'${v}'`)
            .join()}].includes(e.closest('.form-namespace').find('${target}').val())`
        : `e.closest('.form-namespace').find('${target}').val()==='${value}'`
    )
    .join(" && ");

const isCheck = (hdr) => hdr.type && hdr.type.name === "Bool";
const isHoriz = (formStyle) => formStyle === "horiz";
const formRowWrap = (hdr, inner, error = "", fStyle, labelCols) =>
  div(
    {
      class: ["form-group", isHoriz(fStyle) && "row"],
      ...(hdr.showIf && {
        "data-show-if": mkShowIf(hdr.showIf),
      }),
    },
    isCheck(hdr)
      ? div(
          {
            class:
              isHoriz(fStyle) &&
              `col-sm-${12 - labelCols} offset-md-${labelCols}`,
          },
          div(
            { class: "form-check" },
            inner,
            label(
              {
                for: `input${text_attr(hdr.form_name)}`,
                class: "form-check-label",
              },
              text(hdr.label)
            ),
            text(error)
          )
        )
      : hdr.input_type === "section_header"
      ? div({ class: `col-sm-12` }, h5(text(hdr.label)))
      : [
          label(
            {
              for: `input${text_attr(hdr.form_name)}`,
              class: isHoriz(fStyle) && `col-sm-${labelCols} col-form-label`,
            },
            text(hdr.label)
          ),
          div(
            { class: isHoriz(fStyle) && `col-sm-${12 - labelCols}` },
            inner,
            text(error)
          ),
        ],
    hdr.sublabel &&
      div(
        {
          class:
            isHoriz(fStyle) &&
            `col-sm-${12 - labelCols} offset-md-${labelCols}`,
        },
        i(text(hdr.sublabel))
      )
  );

const innerField = (v, errors, nameAdd = "") => (hdr) => {
  const name = hdr.form_name + nameAdd;
  const validClass = errors[name] ? "is-invalid" : "";
  const maybe_disabled = hdr.disabled ? "disabled" : "";
  switch (hdr.input_type) {
    case "fromtype":
      return displayEdit(
        hdr,
        name,
        v && isdef(v[hdr.form_name]) ? v[hdr.form_name] : hdr.default,
        validClass
      );
    case "hidden":
      return `<input type="hidden" class="form-control ${validClass} ${
        hdr.class || ""
      }" name="${text_attr(name)}" ${
        v ? `value="${text_attr(v[hdr.form_name])}"` : ""
      }>`;
    case "select":
      const opts = select_options(v, hdr);
      return `<select class="form-control ${validClass} ${
        hdr.class || ""
      }" ${maybe_disabled} name="${text_attr(name)}" id="input${text_attr(
        name
      )}"${
        hdr.attributes && hdr.attributes.explainers
          ? ` data-explainers="${encodeURIComponent(
              JSON.stringify(hdr.attributes.explainers)
            )}"`
          : ""
      }>${opts}</select>`;
    case "textarea":
      return `<textarea class="form-control ${validClass} ${
        hdr.class || ""
      }" ${maybe_disabled} name="${text_attr(name)}" id="input${text_attr(
        name
      )}">${text(v[hdr.form_name])}</textarea>`;
    case "file":
      if (hdr.attributes && hdr.attributes.select_file_where) {
        hdr.input_type = "select";
        return innerField(v, errors, nameAdd)(hdr);
      } else
        return `${
          v[hdr.form_name] ? text(v[hdr.form_name]) : ""
        }<input type="file" class="form-control-file ${validClass} ${
          hdr.class || ""
        }" ${maybe_disabled} name="${text_attr(name)}" id="input${text_attr(
          name
        )}">`;
    case "search":
      return search_bar(name, v && v[hdr.form_name]);
    case "section_header":
      return "";
    case "custom_html":
      return hdr.attributes.html;
    default:
      const the_input = `<input type="${
        hdr.input_type
      }" class="form-control ${validClass} ${
        hdr.class || ""
      }" ${maybe_disabled} name="${name}" id="input${text_attr(name)}" ${
        v && isdef(v[hdr.form_name])
          ? `value="${text_attr(v[hdr.form_name])}"`
          : ""
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
      return inner;
  }
};

const mkFormRow = (v, errors, formStyle, labelCols) => (hdr) =>
  hdr.isRepeat
    ? mkFormRowForRepeat(v, errors, formStyle, labelCols, hdr)
    : mkFormRowForField(v, errors, formStyle, labelCols)(hdr);

const mkFormRowForRepeat = (v, errors, formStyle, labelCols, hdr) => {
  const adder = a(
    {
      class: "btn btn-sm btn-outline-primary",
      href: `javascript:add_repeater('${hdr.form_name}')`,
      title: "Add",
    },
    i({ class: "fas fa-plus" })
  );
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
  if (Array.isArray(v[hdr.form_name]) && v[hdr.form_name].length > 0) {
    return (
      div(
        { class: `repeats-${hdr.form_name}` },
        v[hdr.form_name].map((vi, ix) => {
          return div(
            { class: `form-repeat form-namespace repeat-${hdr.form_name}` },
            icons,
            hdr.fields.map((f) => {
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
        { class: `repeats-${hdr.form_name}` },
        div(
          { class: `form-repeat form-namespace repeat-${hdr.form_name}` },
          icons,
          hdr.fields.map((f) => {
            return mkFormRowForField(v, errors, formStyle, labelCols, "_0")(f);
          })
        )
      ) + adder
    );
  }
};

const displayEdit = (hdr, name, v, extracls) => {
  var fieldview;
  var attributes = hdr.attributes;
  if (hdr.disabled) attributes.disabled = true;
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
    attributes,
    extracls + " " + hdr.class,
    hdr.required
  );
};

const mkFormRowForField = (v, errors, formStyle, labelCols, nameAdd = "") => (
  hdr
) => {
  const name = hdr.form_name + nameAdd;
  const errorFeedback = errors[name]
    ? `<div class="invalid-feedback">${text(errors[name])}</div>`
    : "";
  if (hdr.input_type === "hidden") {
    return innerField(v, errors, nameAdd)(hdr);
  } else
    return formRowWrap(
      hdr,
      innerField(v, errors, nameAdd)(hdr),
      errorFeedback,
      formStyle,
      labelCols
    );
};

const renderFormLayout = (form) => {
  const blockDispatch = {
    field(segment) {
      const field = form.fields.find((f) => f.name === segment.field_name);
      if (field && field.input_type !== "hidden") {
        const errorFeedback = form.errors[field.name]
          ? `<div class="invalid-feedback">${text(
              form.errors[field.name]
            )}</div>`
          : "";
        return innerField(form.values, form.errors)(field) + errorFeedback;
      } else return "";
    },
    action({ action_label, confirm, action_style, action_size }) {
      const submitAttr = form.xhrSubmit
        ? 'onClick="ajaxSubmitForm(this)" type="button"'
        : 'type="submit"';
      return `<button ${submitAttr} class="${
        action_style === "btn-link"
          ? ""
          : `btn ${action_style || "btn-primary"} ${action_size || ""}`
      }">${text(form.submitLabel || action_label || "Save")}</button>`;
    },
  };
  return renderLayout({ blockDispatch, layout: form.layout });
};

const renderForm = (form, csrfToken) => {
  if (form.isStateForm) {
    form.class += " px-4 py-3";
    form.formStyle = "vert";
    var collapsedSummary = "";
    Object.entries(form.values).forEach(([k, v]) => {
      if (typeof v === "undefined") return;
      if (k[0] !== "_") collapsedSummary += ` ${text(k)}:${text_attr(v)} `;
      if (k === "_fts") collapsedSummary += ` ${escapeHTML(text(v))} `;
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
          "aria-expanded": "false",
        },
        collapsedSummary ||
          (form.__ ? form.__("Search filter") : "Search filter")
      ),

      div(
        {
          class: "dropdown-menu search-form",
          "aria-labelledby": "dropdownMenuButton",
        },
        mkForm(form, csrfToken, form.errors)
      )
    );
  } else if (form.layout) return mkFormWithLayout(form, csrfToken);
  else return mkForm(form, csrfToken, form.errors);
};

const mkFormWithLayout = (form, csrfToken) => {
  const hasFile = form.fields.some((f) => f.input_type === "file");
  const csrfField = `<input type="hidden" name="_csrf" value="${csrfToken}">`;
  const top = `<form action="${form.action}" class="form-namespace ${
    form.class || ""
  }" method="${form.methodGET ? "get" : "post"}" ${
    hasFile ? 'encType="multipart/form-data"' : ""
  }>`;
  const blurbp = form.blurb
    ? Array.isArray(form.blurb)
      ? form.blurb.join("")
      : p(text(form.blurb))
    : "";
  const hiddens = form.fields
    .filter((f) => f.input_type === "hidden")
    .map((f) => innerField(form.values, form.errors)(f))
    .join("");
  const fullFormError = form.errors._form
    ? `<div class="form-group row">
  <div class="col-sm-12">
  <p class="text-danger">${form.errors._form}
  </p>
  </div>
  </div>`
    : "";
  return (
    blurbp +
    top +
    csrfField +
    hiddens +
    renderFormLayout(form) +
    fullFormError +
    "</form>"
  );
};
const displayAdditionalButtons = (additionalButtons) =>
  additionalButtons
    .map(
      (btn) =>
        `<button type="button" id="${btn.id}" class="${btn.class}">${btn.label}</button>&nbsp;`
    )
    .join("");
const mkForm = (form, csrfToken, errors = {}) => {
  const hasFile = form.fields.some((f) => f.input_type === "file");
  const csrfField =
    csrfToken === false
      ? ""
      : `<input type="hidden" name="_csrf" value="${csrfToken}">`;
  const top = `<form ${form.id ? `id="${form.id}" ` : ""}action="${
    form.action
  }" class="form-namespace ${form.isStateForm ? "stateForm" : ""} ${
    form.class || ""
  }" method="${form.methodGET ? "get" : "post"}" ${
    hasFile ? 'encType="multipart/form-data"' : ""
  }>`;
  //console.log(form.fields);
  const flds = form.fields
    .map(
      mkFormRow(
        form.values,
        errors,
        form.formStyle,
        typeof form.labelCols === "undefined" ? 2 : form.labelCols
      )
    )
    .join("");
  const blurbp = form.blurb
    ? Array.isArray(form.blurb)
      ? form.blurb.join("")
      : p(text(form.blurb))
    : "";
  const fullFormError = errors._form
    ? `<div class="form-group row">
  <div class="col-sm-12">
  <p class="text-danger">${errors._form}
  </p>
  </div>
  </div>`
    : "";
  const bot = `<div class="form-group row">
  <div class="col-sm-12">
    ${
      form.additionalButtons
        ? displayAdditionalButtons(form.additionalButtons)
        : ""
    }
    ${
      form.noSubmitButton
        ? ""
        : `<button type="submit" class="btn ${
            form.submitButtonClass || "btn-primary"
          }">${text(form.submitLabel || "Save")}</button>`
    }
  </div>
</div>`;
  return blurbp + top + csrfField + flds + fullFormError + bot + "</form>";
};

module.exports = contract(
  is.fun([is.class("Form"), is.or(is.str, is.eq(false))], is.str),
  renderForm
);
