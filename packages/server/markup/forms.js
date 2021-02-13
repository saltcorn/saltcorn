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

const wizardSteps = (wizardTitle, wf, wfres) => {
  console.log(wf, wfres);
  return div(
    h5(wizardTitle),
    div(
      { class: "d-flex" },
      wf.steps.map(
        (s, ix) =>
          (ix > 0 ? i({ class: "fas fa-chevron-right ml-1" }) : "") +
          div(
            {
              class: [
                "wizardStep",
                ix > 0 && "ml-1",
                wfres.currentStep - 1 === ix
                  ? "active font-weight-bold"
                  : "text-muted",
              ],
            },
            s.name
          )
      )
    )
  );
};

module.exports = { editRoleForm, wizardSteps };
