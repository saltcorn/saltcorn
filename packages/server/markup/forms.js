const {
  form,
  select,
  option,
  text,
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

const wizardCardTitle = (wizardTitle, wf, wfres) => 
  `${wizardTitle}: ${wfres.stepName}`

module.exports = { editRoleForm, wizardCardTitle };
