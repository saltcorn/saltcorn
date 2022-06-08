/**
 * @category saltcorn-markup
 * @module form
 */

import tags = require("./tags");
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
  script,
  domReady,
  ul,
} = tags;
import renderLayout = require("./layout");
import helpers = require("./helpers");
import type { SearchBarOpts, RadioGroupOpts } from "./helpers";
const { isdef, select_options, search_bar } = helpers;
import type { AbstractForm as Form } from "@saltcorn/types/model-abstracts/abstract_form";
import {
  AbstractFieldRepeat,
  instanceOfField,
} from "@saltcorn/types/model-abstracts/abstract_field";
import { FieldLike } from "@saltcorn/types/base_types";

declare const window: any;
const isNode = typeof window === "undefined";

/**
 * @param {string} s
 * @returns {string}
 */
const rmInitialDot = (s: string): string =>
  s && s[0] === "." ? s.replace(".", "") : s;

const buildActionAttribute = (form: Form): string =>
  isNode && !form.req?.smr ? form.action! : "javascript:void(0)";

/**
 * @param {object} sIf
 * @returns {string}
 */
const mkShowIf = (sIf: any): string =>
  encodeURIComponent(
    Object.entries(sIf)
      .map(([target, value]) =>
        typeof value === "boolean"
          ? `e.closest('.form-namespace').find('[data-fieldname=${rmInitialDot(
              target
            )}]').prop('checked')===${JSON.stringify(value)}`
          : Array.isArray(value)
          ? `[${value
              .map((v) => `'${v}'`)
              .join()}].includes(e.closest('.form-namespace').find('[data-fieldname=${rmInitialDot(
              target
            )}]').val())`
          : `e.closest('.form-namespace').find('[data-fieldname=${rmInitialDot(
              target
            )}]').val()==='${value}'`
      )
      .join(" && ")
  );

/**
 * @param {string} formStyle
 * @returns {boolean}
 */
const isHoriz = (formStyle: string): boolean => formStyle === "horiz";

/**
 * @param {object} hdr
 * @param {object} inner
 * @param {string} [error = ""]
 * @param {string} fStyle
 * @param {number} labelCols
 * @returns {string}
 */
const formRowWrap = (
  hdr: any,
  inner: any,
  error: string = "",
  fStyle: string,
  labelCols: number
): string =>
  div(
    {
      class: ["form-group", isHoriz(fStyle) && "row"],
      "data-disabled": hdr.disabled ? "true" : false,
      ...(hdr.showIf && {
        style: "display: none;",
        "data-show-if": mkShowIf(hdr.showIf),
      }),
    },
    hdr.input_type === "section_header"
      ? div(
          { class: `col-sm-12` },
          h5(text(hdr.label)),
          hdr.sublabel && p(i(hdr.sublabel))
        )
      : hdr.type?.name === "Bool" && fStyle === "vert"
      ? div(
          { class: "form-check" },
          inner,
          label(
            {
              for: `input${text_attr(hdr.form_name)}`,
            },
            text(hdr.label)
          )
        ) + (hdr.sublabel ? i(text(hdr.sublabel)) : "")
      : [
          div(
            { class: isHoriz(fStyle) && `col-sm-${labelCols}` },
            label(
              {
                for: `input${text_attr(hdr.form_name)}`,
              },
              text(hdr.label)
            )
          ),
          div(
            { class: isHoriz(fStyle) && `col-sm-${12 - labelCols}` },
            inner,
            text(error),
            hdr.sublabel && i(text(hdr.sublabel))
          ),
        ]
  );

/**
 * @param {object} v
 * @param {object[]} errors
 * @param {string} [nameAdd = ""]
 * @returns {function}
 */
const innerField =
  (
    v: any,
    errors: any[],
    nameAdd: string = "",
    classAdd: string = ""
  ): ((hdr: any) => string) =>
  (hdr: any): string => {
    const name: any = hdr.form_name + nameAdd;
    const validClass = errors[name] ? `is-invalid ${classAdd}` : classAdd;
    const maybe_disabled = hdr.disabled ? " disabled data-disabled" : "";

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
        return `<select class="form-control form-select ${validClass} ${
          hdr.class || ""
        }"${maybe_disabled} data-fieldname="${text_attr(
          hdr.form_name
        )}" name="${text_attr(name)}" id="input${text_attr(name)}"${
          hdr.attributes && hdr.attributes.explainers
            ? ` data-explainers="${encodeURIComponent(
                JSON.stringify(hdr.attributes.explainers)
              )}"`
            : ""
        }>${opts}</select>`;
      case "textarea":
        return `<textarea class="form-control ${validClass} ${
          hdr.class || ""
        }"${maybe_disabled} data-fieldname="${text_attr(
          hdr.form_name
        )}" name="${text_attr(name)}" id="input${text_attr(name)}">${text(
          v[hdr.form_name] || ""
        )}</textarea>`;
      case "code":
        return `<textarea mode="${
          (hdr.attributes || {}).mode || ""
        }" class="to-code form-control ${validClass} ${
          hdr.class || ""
        }"${maybe_disabled} data-fieldname="${text_attr(
          hdr.form_name
        )}" name="${text_attr(name)}" id="input${text_attr(name)}">${
          v[hdr.form_name] || ""
        }</textarea>`;
      case "file":
        if (hdr.attributes && hdr.attributes.select_file_where) {
          hdr.input_type = "select";
          return innerField(v, errors, nameAdd)(hdr);
        } else
          return `${
            v[hdr.form_name] ? text(v[hdr.form_name]) : ""
          }<input type="file" class="form-control-file ${validClass} ${
            hdr.class || ""
          }"${maybe_disabled} name="${text_attr(name)}" id="input${text_attr(
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
        }"${maybe_disabled} data-fieldname="${text_attr(
          hdr.form_name
        )}" name="${name}" id="input${text_attr(name)}"${
          v && isdef(v[hdr.form_name])
            ? ` value="${text_attr(v[hdr.form_name])}"`
            : ""
        }>`;
        const inner = hdr.postText
          ? div(
              { class: "input-group" },
              the_input,

              span(
                { class: "input-group-text", id: "basic-addon2" },
                hdr.postText
              )
            )
          : the_input;
        return inner;
    }
  };

/**
 * @param {object[]} v
 * @param {object[]} errors
 * @param {string} formStyle
 * @param {object[]} labelCols
 * @returns {function}
 */
const mkFormRow =
  (
    v: any,
    errors: any[],
    formStyle: string,
    labelCols: any
  ): ((hdr: any) => string) =>
  (hdr: any): string =>
    hdr.isRepeat && hdr.fancyMenuEditor
      ? mkFormRowForRepeatFancy(v, errors, formStyle, labelCols, hdr)
      : hdr.isRepeat
      ? mkFormRowForRepeat(v, errors, formStyle, labelCols, hdr)
      : mkFormRowForField(v, errors, formStyle, labelCols)(hdr);

/**
 * @param {object[]} v
 * @param {object[]} errors
 * @param {string} formStyle
 * @param {object[]} labelCols
 * @param {object} hdr
 * @returns {div}
 */
const mkFormRowForRepeatFancy = (
  v: any,
  errors: any[],
  formStyle: string,
  labelCols: number,
  hdr: any
): string => {
  // console.log(v);

  return div(
    { class: "row w-100" },
    div(
      { class: "col-6" },
      h5("Columns"),
      div(ul({ id: "myEditor", class: "sortableLists list-group" }))
    ),
    div(
      { class: "col-6 mb-3", id: "menuForm" },
      h5("Column configuration"),
      hdr.fields.forEach((f: any) => (f.class = `${f.class || ""} item-menu`)),
      hdr.fields.map(mkFormRow({}, errors, "vert", labelCols)),
      button(
        { type: "button", id: "btnUpdate", class: "btn btn-primary me-2" },
        "Update"
      ),
      button({ type: "button", id: "btnAdd", class: "btn btn-primary" }, "Add")
    ),
    script(
      domReady(`
      var iconPickerOptions = {searchText: "Search icon...", labelHeader: "{0}/{1}"};

      var sortableListOptions = {
        placeholderCss: {'background-color': "#cccccc"},
    
    };
    let editor = new MenuEditor('myEditor', 
              { 
              listOptions: sortableListOptions, 
              iconPicker: iconPickerOptions,
              getLabelText: columnSummary,
              onUpdate: ()=>{
                apply_showif();
                repeaterCopyValuesToForm($('#menuForm').closest("form"), editor);
              },
              labelEdit: 'Edit&nbsp;<i class="fas fa-edit clickable"></i>',
              maxLevel: 0 // (Optional) Default is -1 (no level limit)
              // Valid levels are from [0, 1, 2, 3,...N]
              });
  editor.setForm($('#menuForm'));
  editor.setUpdateButton($('#btnUpdate'));
  editor.setData(${JSON.stringify(v[hdr.form_name])});
  $('.btnEdit').click(()=>setTimeout(apply_showif,0));
  $('#btnAdd').click(function(){
    editor.add();
    repeaterCopyValuesToForm($('#menuForm').closest("form"), editor)
  });

  $("#btnUpdate").click(function(){
    editor.update();
    repeaterCopyValuesToForm($('#menuForm').closest("form"), editor)
  });
  $('#menuForm').closest("form").submit(function(event) {
    event.preventDefault(); //this will prevent the default submit

    repeaterCopyValuesToForm($('#menuForm').closest("form"), editor)
    $(this).unbind('submit').submit(); // continue the submit unbind preventDefault
   })
   setTimeout(()=>repeaterCopyValuesToForm($('#menuForm').closest("form"), editor), 0);
   `)
    )
  );
};
const repeater_icons = div(
  { class: "float-end" },
  span({ onclick: "rep_up(this)" }, i({ class: "fa fa-arrow-up pull-right" })),
  "&nbsp;",
  span({ onclick: "rep_del(this)" }, i({ class: "fa fa-times pull-right" })),
  "&nbsp;",
  span(
    { onclick: "rep_down(this)" },
    i({ class: "fa fa-arrow-down pull-right" })
  )
);
const repeater_adder = (form_name: string) =>
  a(
    {
      class: "btn btn-sm btn-outline-primary mb-3",
      href: `javascript:add_repeater('${form_name}')`,
      title: "Add",
    },
    i({ class: "fas fa-plus" })
  );

/**
 * @param {object[]} v
 * @param {object[]} errors
 * @param {string} formStyle
 * @param {object[]} labelCols
 * @param {object} hdr
 * @returns {div}
 */
const mkFormRowForRepeat = (
  v: any,
  errors: any[],
  formStyle: string,
  labelCols: number,
  hdr: any
): string => {
  const adder = repeater_adder(hdr.form_name);
  if (Array.isArray(v[hdr.form_name]) && v[hdr.form_name].length > 0) {
    return div(
      hdr.showIf
        ? {
            "data-show-if": mkShowIf(hdr.showIf),
          }
        : {},
      div(
        {
          class: `repeats-${hdr.form_name}`,
        },
        v[hdr.form_name].map((vi: any, ix: number) => {
          return div(
            { class: `form-repeat form-namespace repeat-${hdr.form_name}` },
            repeater_icons,
            hdr.fields.map((f: any) => {
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
      ),
      adder
    );
  } else {
    return div(
      hdr.showIf
        ? {
            "data-show-if": mkShowIf(hdr.showIf),
          }
        : {},
      div(
        {
          class: `repeats-${hdr.form_name}`,
        },
        div(
          { class: `form-repeat form-namespace repeat-${hdr.form_name}` },
          repeater_icons,
          hdr.fields.map((f: any) => {
            return mkFormRowForField(v, errors, formStyle, labelCols, "_0")(f);
          })
        )
      ),
      adder
    );
  }
};

/**
 * @param {object} hdr
 * @param {string} name
 * @param {object} v
 * @param {string} extracls
 * @returns {*}
 */
const displayEdit = (hdr: any, name: string, v: any, extracls: string): any => {
  let fieldview: any;
  const attributes = hdr.attributes;
  if (hdr.disabled) attributes.disabled = true;
  if (hdr.fieldviewObj) {
    fieldview = hdr.fieldviewObj;
  } else if (hdr.fieldview && hdr.type && hdr.type.fieldviews[hdr.fieldview])
    fieldview = hdr.type.fieldviews[hdr.fieldview];
  else if (hdr.type && hdr.type.fieldviews) {
    const found = Object.entries(hdr.type.fieldviews).find(
      ([nm, fv]: [string, any]) => fv.isEdit
    );
    if (found) {
      fieldview = found[1];
    }
  }
  if (!fieldview) {
    if (!hdr.type)
      throw new Error(`Unknown type ${hdr.typename} in field ${name}`);
    else throw new Error(`Cannot find fieldview for field ${name}`);
  }
  if (fieldview.isEdit)
    return fieldview.run(
      name,
      v,
      attributes,
      extracls + " " + hdr.class,
      hdr.required,
      hdr
    );
  else return fieldview.run(v, undefined, attributes);
};

/**
 * @param {object[]} v
 * @param {object[]} errors
 * @param {string} formStyle
 * @param {number} labelCols
 * @param {string} [nameAdd = ""]
 * @returns {function}
 */
const mkFormRowForField =
  (
    v: any,
    errors: any[],
    formStyle: string,
    labelCols: number,
    nameAdd: string = ""
  ): ((hdr: any) => string) =>
  (hdr: any): string => {
    const name: any = hdr.form_name + nameAdd;
    const errorFeedback = errors[name]
      ? `<div class="invalid-feedback">${text(errors[name])}</div>`
      : "";
    if (hdr.input_type === "hidden") {
      return innerField(v, errors, nameAdd)(hdr);
    } else
      return formRowWrap(
        hdr,
        innerField(
          v,
          errors,
          nameAdd,
          hdr.type?.name === "Bool" && formStyle === "vert"
            ? "form-check-input"
            : ""
        )(hdr),
        errorFeedback,
        formStyle,
        labelCols
      );
  };

/**
 * @param {object} form
 * @returns {string}
 */
const renderFormLayout = (form: Form): string => {
  const blockDispatch: any = {
    join_field(segment: any) {
      if (segment.sourceURL)
        return div({ "data-source-url": segment.sourceURL });
      return "";
    },
    tabs(segment: any, go: any) {
      if (segment.tabsStyle !== "Value switch") return false;
      return segment.titles
        .map((t: any, ix: number) =>
          div(
            {
              style: "display: none;",
              "data-show-if": mkShowIf({
                [segment.field]: typeof t.value === "undefined" ? t : t.value,
              }),
            },
            go(segment.contents[ix])
          )
        )
        .join("");
    },
    field_repeat({ field_repeat }: any, go: any) {
      const hdr = field_repeat;

      return div(
        hdr.showIf
          ? {
              "data-show-if": mkShowIf(hdr.showIf),
            }
          : {},
        div(
          {
            class: `repeats-${hdr.form_name}`,
          },
          field_repeat.metadata?.rows && field_repeat.metadata?.rows.length > 0
            ? field_repeat.metadata.rows.map((row: any, ix: number) => {
                field_repeat.metadata.current_row = row;
                field_repeat.metadata.current_ix = ix;
                return div(
                  {
                    class: `form-repeat form-namespace repeat-${hdr.form_name}`,
                  },
                  repeater_icons,
                  go(field_repeat.layout),
                  field_repeat.fields
                    .filter(
                      (f: FieldLike) => f.input_type === "hidden" && f.name
                    )
                    .map((f: FieldLike) => innerField(row, [], `_${ix}`)(f))
                );
              })
            : div(
                { class: `form-repeat form-namespace repeat-${hdr.form_name}` },
                repeater_icons,
                go(field_repeat.layout)
              )
        ),
        repeater_adder(hdr.form_name)
      );

      //mkFormRowForRepeat({}, [], "", 3, field_repeat)
    },
    field(segment: any) {
      const [repeat_name, field_name] = segment.field_name.split(".");
      const in_repeat = !!field_name;
      const field0 = segment.field_name.includes(".")
        ? (
            form.fields.find(
              (f) => f.name === repeat_name
            ) as AbstractFieldRepeat
          )?.fields.find((f: any) => f.name === field_name)
        : form.fields.find((f) => f.name === segment.field_name);
      const repeater = in_repeat
        ? form.fields.find((f) => f.name === repeat_name)
        : null;
      const field = { ...field0 };
      if (instanceOfField(field) && field.input_type !== "hidden") {
        if (field.sourceURL) return div({ "data-source-url": field.sourceURL });
        if (instanceOfField(field0)) field.form_name = field0.form_name;

        const errorFeedback = form.errors[field.name]
          ? `<div class="invalid-feedback">${text(
              form.errors[field.name]
            )}</div>`
          : "";
        if (segment.fieldview) field.fieldview = segment.fieldview;
        field.attributes = { ...field.attributes, ...segment.configuration };
        return (
          innerField(
            in_repeat
              ? (repeater as any)?.metadata?.current_row || {}
              : form.values,
            form.errors,
            in_repeat
              ? `_${(repeater as any)?.metadata?.current_ix || 0}`
              : undefined
          )(field) + errorFeedback
        );
      } else return "";
    },
    action({
      action_name,
      action_label,
      action_url,
      confirm,
      action_style,
      action_size,
      action_icon,
      configuration,
      action_bgcol,
      action_bordercol,
      action_textcol,
    }: any) {
      const isMobile = !isNode || form.req?.smr;
      let style =
        action_style === "btn-custom-color"
          ? `background-color: ${action_bgcol || "#000000"};border-color: ${
              action_bordercol || "#000000"
            }; color: ${action_textcol || "#000000"}`
          : null;
      const confirmStr = confirm ? `if(confirm('${"Are you sure?"}'))` : "";

      if (action_name && action_name.startsWith("Login with ")) {
        const method_label = action_name.replace("Login with ", "");

        return a(
          {
            href: `/auth/login-with/${method_label}`,
            //TODO get url through form.req to reduce coupling
            class: [
              action_style !== "btn-link" &&
                `btn ${action_style || "btn-primary"} ${action_size || ""}`,
            ],
            style,
          },
          action_icon ? i({ class: action_icon }) + "&nbsp;" : false,
          action_label || action_name
        );
      }
      const mkBtn = (onclick_or_type: string) =>
        `<button ${onclick_or_type} class="${
          action_style === "btn-link"
            ? ""
            : `btn ${action_style || "btn-primary"} ${action_size || ""}`
        }"${style ? ` style="${style}"` : ""}>${
          action_icon ? `<i class="${action_icon}"></i>&nbsp;` : ""
        }${text(
          action_label || form.submitLabel || action_name || "Save"
        )}</button>`;

      if (action_name === "Delete") {
        if (action_url) {
          const dest = (configuration && configuration.after_delete_url) || "/";
          if (isNode && !form.req?.smr) {
            return mkBtn(
              `onClick="${confirmStr}ajax_post('${action_url}', {success:()=>window.location.href='${dest}'})" type="button"`
            );
          } else {
            return mkBtn(
              `onClick="${confirmStr}local_post('${action_url}', {after_delete_url:'${dest}'})" type="button"`
            );
          }
        } else return "";
      }
      if (action_name === "Reset") {
        return mkBtn(
          `onClick="${confirmStr}$(this).closest('form').trigger('reset')" type="button"`
        );
      }
      if (action_name === "GoBack") {
        const isWeb = isNode && !form.req?.smr;
        const reload = configuration.reload_after ? "reload_on_init();" : "";
        const doNav =
          !configuration.steps || configuration.steps === 1
            ? isWeb
              ? "history.back()"
              : "parent.goBack()"
            : isWeb
            ? `history.go(${-1 * configuration.steps})`
            : `parent.goBack(${configuration.steps})`;
        if (configuration.save_first) {
          const complete = `()=>${doNav}`;
          return mkBtn(
            `onClick="${reload}saveAndContinue(this,${
              isMobile ? `'${form.action}', ${complete}` : complete
            })" type="button"`
          );
        } else return mkBtn(`onClick="${reload}${doNav}" type="button"`);
      }
      if (action_name === "SaveAndContinue") {
        return (
          mkBtn(
            `onClick="saveAndContinue(this,${
              isMobile ? `'${form.action}'` : undefined
            })" type="button"`
          ) +
          script(
            // cant use currentScript in callback
            `((myScript)=>{` +
              domReady(`
            $(myScript).closest('form').find('input').keydown(function (e) {
            if (e.keyCode == 13) {
                e.preventDefault();
                saveAndContinue(myScript,${
                  isMobile ? `'${form.action}'` : undefined
                });
                return false;
            }
        });`) +
              `})(document.currentScript)`
          )
        );
      }
      if (isNode && !form.req?.smr) {
        const submitAttr = form.xhrSubmit
          ? 'onClick="ajaxSubmitForm(this)" type="button"'
          : 'type="submit"';
        return mkBtn(submitAttr);
      }
      return mkBtn('type="submit"');
    },
  };
  return renderLayout({ blockDispatch, layout: form.layout, req: form.req });
};

/**
 * @param {string|object} form
 * @param {string|false} csrfToken0
 * @returns {string}
 */
const renderForm = (
  form: Form | string,
  csrfToken0: string | boolean
): string => {
  if (typeof form === "string") return form;

  const csrfToken =
    csrfToken0 === false || csrfToken0 === ""
      ? csrfToken0
      : csrfToken0 || (form.req && form.req.csrfToken && form.req.csrfToken());

  if (form.isStateForm) {
    form.class += " px-4 py-3";
    form.formStyle = "vert";
    var collapsedSummary = "";
    Object.entries(form.values).forEach(([k, v]) => {
      if (typeof v === "undefined") return;
      if (k[0] !== "_")
        collapsedSummary += ` ${text(k)}:${text_attr(v as string)} `;
      if (k === "_fts") collapsedSummary += ` ${text_attr(v as string)} `;
    });
    return div(
      { class: "dropdown" },
      button(
        {
          class: "btn btn-secondary dropdown-toggle",
          type: "button",
          id: "dropdownMenuButton",
          "data-bs-toggle": "dropdown",
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

/**
 * @param {object} form
 * @param {string} csrfToken
 * @returns {string}
 */
const mkFormWithLayout = (form: Form, csrfToken: string | boolean): string => {
  const hasFile = form.fields.some((f: any) => f.input_type === "file");
  const csrfField = `<input type="hidden" name="_csrf" value="${csrfToken}">`;
  const top = `<form action="${buildActionAttribute(form)}"${
    form.onSubmit ? ` onsubmit="${form.onSubmit}" ` : ""
  }${
    form.onChange ? ` onchange="${form.onChange}"` : ""
  } class="form-namespace ${form.class || ""}" method="${
    form.methodGET ? "get" : "post"
  }"${hasFile ? ' encType="multipart/form-data"' : ""}>`;
  const blurbp = form.blurb
    ? Array.isArray(form.blurb)
      ? form.blurb.join("")
      : p(text(form.blurb))
    : "";
  const hiddens = form.fields
    .filter((f: any) => f.input_type === "hidden")
    .map((f: any) => innerField(form.values, form.errors)(f))
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

/**
 * @param {object[]} additionalButtons
 * @returns {string}
 */
const displayAdditionalButtons = (additionalButtons: any[]): string =>
  additionalButtons
    .map(
      (btn) =>
        `<button type="button" id="${btn.id}" class="${btn.class}"${
          btn.onclick ? ` onclick="${btn.onclick}"` : ""
        }>${btn.label}</button>&nbsp;`
    )
    .join("");

/**
 * @param {object} form
 * @param {string} csrfToken
 * @param {object} [errors = {}]
 * @returns {string}
 */
const mkForm = (
  form: Form,
  csrfToken: string | boolean,
  errors: any = {}
): string => {
  const hasFile = form.fields.some((f: any) => f.input_type === "file");
  const csrfField =
    csrfToken === false
      ? ""
      : `<input type="hidden" name="_csrf" value="${csrfToken}">`;
  const top = `<form ${
    form.id ? `id="${form.id}" ` : ""
  }action="${buildActionAttribute(form)}"${
    form.onSubmit ? ` onsubmit="${form.onSubmit}"` : ""
  } ${
    form.onChange ? ` onchange="${form.onChange}"` : ""
  }class="form-namespace ${form.isStateForm ? "stateForm" : ""} ${
    form.class || ""
  }" method="${form.methodGET ? "get" : "post"}"${
    hasFile ? ' encType="multipart/form-data"' : ""
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

export = renderForm;
