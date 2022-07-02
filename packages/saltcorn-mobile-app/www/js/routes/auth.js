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

const renderLoginForm = (entryView, version_tag) => {
  const loginForm = buildForm(entryView);
  const layout = saltcorn.data.state.getState().layouts["sbadmin2"];
  return layout.authWrap({
    title: "login",
    form: loginForm,
    authLinks: { signup: "/auth/signup" }, // TODO ch '/auth/signup' link
    alerts: [],
    headers: [
      { css: `static_assets/${version_tag}/saltcorn.css` },
      { script: "js/utils/iframe_view_utils.js" },
    ],
    csrfToken: false,
  });
};

export const getLoginForm = async (context) => {
  return { content: renderLoginForm(context.entryView, context.versionTag) };
};

export const logout = async (context) => {
  const response = await apiCall({ method: "GET", path: "/auth/logout" });
  if (response.data.success) {
    localStorage.removeItem("auth_jwt");
    return { content: renderLoginForm(context.entryView, context.versionTag) };
  } else {
    console.log("unable to logout out");
    return {};
  }
};
