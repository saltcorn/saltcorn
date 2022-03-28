const buildForm = (entryView) => {
  return new saltcorn.data.models.Form({
    class: "login",
    fields: [
      new saltcorn.data.models.Field({
        label: "E-mail",
        name: "email",
        type: "String",
        attributes: {
          input_type: "email",
        },
        validator: (s) => s.length < 128,
      }),
      new saltcorn.data.models.Field({
        label: "Password",
        name: "password",
        input_type: "password",
      }),
    ],
    action: "javascript:void(0);",
    onSubmit: `javascript:loginFormSubmit(this, '${entryView}')`,
    submitLabel: "Login",
  });
};

export const renderLoginForm = (entryView) => {
  let loginForm = buildForm(entryView);
  const layout = saltcorn.data.state.getState().layouts["sbadmin2"];
  return layout.authWrap({
    title: "login",
    form: loginForm,
    authLinks: { signup: "/auth/signup" }, // TODO ch '/auth/signup' link
    alerts: [],
    headers: [],
    csrfToken: false,
  });
};
