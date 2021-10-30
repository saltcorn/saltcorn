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

const wizardCardTitle = (wizardTitle, wf, wfres) =>
  `${wizardTitle}: ${wfres.stepName}`;

module.exports = { editRoleForm, wizardCardTitle, fileUploadForm };
