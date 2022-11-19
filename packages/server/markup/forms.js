/**
 * @category server
 * @module markup/forms
 * @subcategory markup
 */

const {
  form,
  select,
  option,
  text,
  label,
  input,
} = require("@saltcorn/markup/tags");
const { csrfField } = require("../routes/utils");

/**
 * @param {object} opts
 * @param {string} opts.url
 * @param {Role} opts.current_role
 * @param {Role[]} opts.roles
 * @param {object} opts.req
 * @returns {Form}
 */
const editRoleForm = ({ url, current_role, roles, req }) =>
  form(
    {
      action: url,
      method: "post",
    },
    csrfField(req),
    select(
      { name: "role", onchange: "form.submit()" },
      roles.map((role) =>
        option(
          {
            value: role.id,
            ...(current_role === role.id && { selected: true }),
          },
          text(role.role)
        )
      )
    )
  );

/**
 * File upload form
 * @param {object} req
 * @param folder
 * @param accept_attr
 * @returns {Form}
 */
const fileUploadForm = (req, folder, accept_attr) => {
    return form(
        {
            action: "/files/upload",
            method: "post",
            encType: "multipart/form-data",
        },
        csrfField(req),
        label(req.__("Upload file(s)")),
        typeof accept_attr !== "undefined"?
            input({
                name: "file",
                class: "form-control ms-1 w-unset d-inline",
                type: "file",
                onchange: "form.submit()",
                multiple: true,
                accept : accept_attr,
            }) :
            input({
                name: "file",
                class: "form-control ms-1 w-unset d-inline",
                type: "file",
                onchange: "form.submit()",
                multiple: true,
            }),
        folder && input({type: "hidden", name: "folder", value: folder})
    );
};

/**
 * @param {string} wizardTitle 
 * @param {*} wf 
 * @param {object} wfres 
 * @returns {string}
 */
const wizardCardTitle = (wizardTitle, wf, wfres) =>
  `${wizardTitle}: ${wfres.stepName}`;

module.exports = { editRoleForm, wizardCardTitle, fileUploadForm };
