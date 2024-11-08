/*global saltcorn */
import { MobileRequest } from "../mocks/request";
import { MobileResponse } from "../mocks/response";
import { apiCall } from "../../helpers/api";
import { removeJwt } from "../../helpers/auth";
import { sbAdmin2Layout, getHeaders } from "../utils";
import { clearHistory } from "../../helpers/navigation";

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

const renderLoginView = async (entryPoint, versionTag, alerts = []) => {
  const state = saltcorn.data.state.getState();
  const form = prepareAuthForm(entryPoint);
  form.onSubmit = `javascript:loginFormSubmit(this, '${entryPoint}')`;
  form.submitLabel = "Login";
  const layout = sbAdmin2Layout();
  const login_form_name = state.getConfig("login_form", "");
  if (login_form_name) {
    const login_form = saltcorn.data.models.View.findOne({
      name: login_form_name,
    });
    if (login_form) {
      const req = new MobileRequest();
      const res = new MobileResponse();
      const resp = await login_form.run_possibly_on_page({}, req, res);
      if (login_form.default_render_page) {
        return layout.wrap({
          title: "Login",
          no_menu: true,
          body: resp,
          alerts: [],
          role: req.user ? req.user.role_id : 100,
          req,
          headers: getHeaders(),
          brand: {
            name: state.getConfig("site_name") || "Saltcorn",
            logo: state.mobileConfig.encodedSiteLogo,
          },
        });
      }
    }
  }

  return layout.authWrap({
    title: "login",
    form: form,
    authLinks: getAuthLinks("login", entryPoint),
    alerts,
    headers: [
      { css: `static_assets/${versionTag}/saltcorn.css` },
      { script: "js/iframe_view_utils.js" },
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
      { script: "js/iframe_view_utils.js" },
    ],
    csrfToken: false,
  });
};

export const getLoginView = async (context) => {
  const mobileConfig = saltcorn.data.state.getState().mobileConfig;
  return {
    content: await renderLoginView(
      mobileConfig.entry_point,
      mobileConfig.version_tag,
      context.alerts ? context.alerts : []
    ),
    replaceIframe: true,
  };
};

export const getSignupView = async () => {
  const config = saltcorn.data.state.getState().mobileConfig;
  return {
    content: renderSignupView(config.entry_point, config.version_tag),
    replaceIframe: true,
  };
};

export const logoutAction = async () => {
  const config = saltcorn.data.state.getState().mobileConfig;
  const response = await apiCall({ method: "GET", path: "/auth/logout" });
  if (response.data.success) {
    await removeJwt();
    clearHistory();
    config.jwt = undefined;
    return {
      content: await renderLoginView(config.entry_point, config.version_tag),
    };
  } else {
    console.log("unable to logout");
    return {};
  }
};
