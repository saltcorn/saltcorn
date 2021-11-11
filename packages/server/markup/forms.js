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
  div,
  i,
  h5,
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
 * @param {object} req 
 * @returns {Form}
 */
const fileUploadForm = (req) =>
  form(
    {
      action: "/files/upload",
      method: "post",
      encType: "multipart/form-data",
    },
    csrfField(req),
    label(req.__("Upload file ")),
    input({
      name: "file",
      class: "form-control-file",
      type: "file",
      onchange: "form.submit()",
      multiple: true,
    })
  );

/**
 * @param {string} wizardTitle 
 * @param {*} wf 
 * @param {object} wfres 
 * @returns {string}
 */
const wizardCardTitle = (wizardTitle, wf, wfres) =>
  `${wizardTitle}: ${wfres.stepName}`;

module.exports = { editRoleForm, wizardCardTitle, fileUploadForm };
