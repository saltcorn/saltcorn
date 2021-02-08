const { form, select, option, text } = require("@saltcorn/markup/tags");
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
module.exports = { editRoleForm };
