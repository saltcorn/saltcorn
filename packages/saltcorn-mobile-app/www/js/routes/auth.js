const prepareAuthForm = () => {
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
  });
};

// TODO delete this and integrate getAuthLinks() from '/server/auth/routes.js'
const getAuthLinks = (current, entryPoint) => {
  const links = { methods: [] };
  const state = saltcorn.data.state.getState();
  if (current !== "login") links.login = "javascript:execLink('/auth/login')";
  if (current !== "signup" && state.getConfig("allow_signup"))
    links.signup = "javascript:execLink('/auth/signup')";
  if (state.getConfig("public_user_link"))
    links.publicUser = `javascript:publicLogin('${entryPoint}')`;
  return links;
};

const renderLoginView = (entryPoint, versionTag) => {
  const form = prepareAuthForm(entryPoint);
  form.onSubmit = `javascript:loginFormSubmit(this, '${entryPoint}')`;
  form.submitLabel = "Login";
  return sbAdmin2Layout().authWrap({
    title: "login",
    form: form,
    authLinks: getAuthLinks("login", entryPoint),
    alerts: [],
    headers: [
      { css: `static_assets/${versionTag}/saltcorn.css` },
      { script: "js/utils/iframe_view_utils.js" },
    ],
    csrfToken: false,
  });
};

const renderSignupView = (entryPoint, versionTag) => {
  const form = prepareAuthForm(entryPoint);
  form.onSubmit = `javascript:signupFormSubmit(this, '${entryPoint}')`;
  form.submitLabel = "Sign up";
  return sbAdmin2Layout().authWrap({
    title: "signup",
    form: form,
    authLinks: getAuthLinks("signup", entryPoint),
    alerts: [],
    headers: [
      { css: `static_assets/${versionTag}/saltcorn.css` },
      { script: "js/utils/iframe_view_utils.js" },
    ],
    csrfToken: false,
  });
};

const getLoginView = async () => {
  const config = saltcorn.data.state.getState().mobileConfig;
  return {
    content: renderLoginView(config.entry_point, config.version_tag),
    replaceIframe: true,
  };
};

const getSignupView = async () => {
  const config = saltcorn.data.state.getState().mobileConfig;
  return {
    content: renderSignupView(config.entry_point, config.version_tag),
    replaceIframe: true,
  };
};

const logoutAction = async () => {
  const config = saltcorn.data.state.getState().mobileConfig;
  const response = await apiCall({ method: "GET", path: "/auth/logout" });
  if (response.data.success) {
    await removeJwt();
    config.jwt = undefined;
    return {
      content: renderLoginView(config.entry_point, config.version_tag),
    };
  } else {
    console.log("unable to logout");
    return {};
  }
};
