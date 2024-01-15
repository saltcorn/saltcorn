const Router = require("express-promise-router");

const Form = require("@saltcorn/data/models/form");
const { error_catcher, isAdmin } = require("./utils.js");
const { send_infoarch_page } = require("../markup/admin.js");
const { getState } = require("@saltcorn/data/db/state");
const { a, div, i, p } = require("@saltcorn/markup/tags");
const {
  renderForm,
  link,
  post_delete_btn,
  mkTable,
} = require("@saltcorn/markup");

const router = new Router();
module.exports = router;

const deviceTypes = [
  "mobile",
  "tablet",
  "console",
  "smarttv",
  "wearable",
  "web",
];

const deviceForm = (req, deviceValidator, device) => {
  const sizeValidator = (v) => {
    const n = +v;
    if (isNaN(n)) return req.__("Not a number");
    if (n < 0) return req.__("Must be positive");
  };
  return new Form({
    action: `/page_group/settings/${
      !device ? "add-device" : `edit-device/${device}`
    }`,
    fields: [
      {
        name: "device",
        input_type: "select",
        type: "String",
        options: ["mobile", "tablet", "console", "smarttv", "wearable", "web"],
        required: true,
        validator: deviceValidator,
      },
      {
        name: "width",
        label: req.__("width"),
        type: "String",
        required: true,
        validator: sizeValidator,
      },
      {
        name: "height",
        label: req.__("height"),
        type: "String",
        required: true,
        validator: sizeValidator,
      },
      {
        name: "innerWidth",
        label: req.__("innerWidth"),
        type: "String",
        required: true,
        validator: sizeValidator,
      },
      {
        name: "innerHeight",
        label: req.__("innerHeight"),
        type: "String",
        required: true,
        validator: sizeValidator,
      },
    ],
    additionalButtons: [
      {
        label: device ? req.__("Close") : req.__("Cancel"),
        class: "btn btn-primary",
        onclick: "location.href='/page_group/settings'",
      },
    ],
  });
};

const loadDeviceConfigs = () => {
  const cfg = getState().getConfig("user_agent_screen_infos", {});
  const deviceConfigs = deviceTypes
    .filter((device) => cfg[device])
    .map((device) => ({
      device,
      ...cfg[device],
    }));
  return deviceConfigs;
};

const pageGroupSettingsForm = (req) => {
  return new Form({
    action: "/page_group/settings/config",
    noSubmitButton: true,
    onChange: `saveAndContinue(this)`,
    fields: [
      {
        name: "missing_screen_info_strategy",
        label: req.__("Missing screen info"),
        sublabel: req.__(
          "What to do if no screen info is given. Reload with parmeters or guess it from the user-agent."
        ),
        type: "String",
        input_type: "select",
        options: [
          {
            label: req.__("Guess from user agent"),
            value: "guess_from_user_agent",
          },
          { label: req.__("Reload"), value: "reload" },
        ],
        required: true,
      },
    ],
  });
};

/**
 * load the screen-info table
 */
router.get(
  "/settings",
  isAdmin,
  error_catcher(async (req, res) => {
    const deviceConfigs = loadDeviceConfigs();
    const pgForm = pageGroupSettingsForm(req);
    pgForm.values.missing_screen_info_strategy = getState().getConfig(
      "missing_screen_info_strategy",
      "guess_from_user_agent"
    );
    send_infoarch_page({
      res,
      req,
      active_sub: "Pagegroups",
      contents: [
        {
          type: "card",
          title: req.__("User Agent screen infos"),
          contents: [
            p(
              req.__(
                "This screen infos are used when the browser does not send them. " +
                  "With 'Missing screen info' set to 'Guess from user agent', the user agent gets mapped to a device with the following values."
              )
            ),
            mkTable(
              [
                {
                  label: "Device",
                  key: (r) =>
                    link(
                      `/page_group/settings/edit-device/${r.device}`,
                      r.device
                    ),
                },
                { label: "width", key: (r) => r.width },
                { label: "height", key: (r) => r.height },
                { label: "innerWidth", key: (r) => r.innerWidth },
                { label: "innerHeight", key: (r) => r.innerHeight },
                {
                  label: req.__("Delete"),
                  key: (r) =>
                    post_delete_btn(
                      `/page_group/settings/remove-device/${r.device}`,
                      req,
                      r.device
                    ),
                },
              ],
              deviceConfigs,
              {}
            ),
            div(
              a(
                {
                  href: "settings/add-device",
                  class: "btn btn-primary mt-1 me-3",
                },
                i({ class: "fas fa-plus-square me-1" }),
                req.__("Add screen info")
              )
            ),
          ],
        },

        {
          type: "card",
          title: req.__("Page Group settings"),
          contents: [renderForm(pgForm, req.csrfToken())],
        },
      ],
    });
  })
);
/**
 * load a form to add a screen-info to the config
 */
router.get(
  "/settings/add-device",
  isAdmin,
  error_catcher(async (req, res) => {
    send_infoarch_page({
      res,
      req,
      active_sub: "Pagegroups",
      contents: {
        type: "card",
        title: req.__("Add screen info"),
        contents: [
          renderForm(
            deviceForm(req, () => {}),
            req.csrfToken()
          ),
        ],
      },
    });
  })
);

/**
 * add a screen-info to the config
 */
router.post(
  "/settings/add-device",
  isAdmin,
  error_catcher(async (req, res) => {
    const cfg = getState().getConfig("user_agent_screen_infos", {});
    const validator = (v) => {
      if (cfg[v]) return req.__("Device already exists");
    };
    const form = deviceForm(req, validator);
    form.validate(req.body);
    if (form.hasErrors) {
      send_infoarch_page({
        res,
        req,
        active_sub: "Pagegroups",
        contents: {
          type: "card",
          title: req.__("Add screen info"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
    } else {
      const { device, width, height, innerWidth, innerHeight } = form.values;
      const newCfg = {
        ...cfg,
        [device]: { width, height, innerWidth, innerHeight },
      };
      await getState().setConfig("user_agent_screen_infos", newCfg);
      req.flash("success", req.__("Screen info added"));
      res.redirect("/page_group/settings");
    }
  })
);

/**
 * remove a screen-info from the config
 */
router.post(
  "/settings/remove-device/:device",
  isAdmin,
  error_catcher(async (req, res) => {
    const { device } = req.params;
    const cfg = getState().getConfig("user_agent_screen_infos", {});
    const newCfg = { ...cfg };
    delete newCfg[device];
    await getState().setConfig("user_agent_screen_infos", newCfg);
    req.flash("success", req.__("Screen info removed"));
    res.redirect("/page_group/settings");
  })
);

/**
 * load a form to edit a screen-info
 */
router.get(
  "/settings/edit-device/:device",
  isAdmin,
  error_catcher(async (req, res) => {
    const { device } = req.params;
    const cfg = getState().getConfig("user_agent_screen_infos", {});
    const deviceCfg = cfg[device];
    const form = deviceForm(req, () => {}, device);
    form.values = { device, ...deviceCfg };
    send_infoarch_page({
      res,
      req,
      active_sub: "Pagegroups",
      contents: {
        type: "card",
        title: req.__("Edit screen info"),
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);

/**
 * edit a screen-info
 */
router.post(
  "/settings/edit-device/:device",
  isAdmin,
  error_catcher(async (req, res) => {
    const { device } = req.params;
    const cfg = getState().getConfig("user_agent_screen_infos", {});
    const validator = (v) => {
      if (cfg[v] && v !== device) return req.__("Device already exists");
    };
    const form = deviceForm(req, validator, device);
    const deviceCfg = cfg[device];
    form.values = { device, ...deviceCfg };
    form.validate(req.body);
    if (form.hasErrors) {
      send_infoarch_page({
        res,
        req,
        active_sub: "Pagegroups",
        contents: {
          type: "card",
          title: req.__("Edit device"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
    } else {
      const { width, height, innerWidth, innerHeight } = form.values;
      const newCfg = {
        ...cfg,
        [form.values.device]: { width, height, innerWidth, innerHeight },
      };
      if (device !== form.values.device) delete newCfg[device];
      await getState().setConfig("user_agent_screen_infos", newCfg);
      req.flash("success", req.__("Screen info saved"));
      res.redirect("/page_group/settings");
    }
  })
);

/**
 * save the missing_screen_info_strategy
 * This configures what to do if no screen info is given (reload or guess from user-agent)
 */
router.post(
  "/settings/config",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = pageGroupSettingsForm(req);
    form.validate(req.body);
    if (form.hasErrors) {
      send_infoarch_page({
        res,
        req,
        active_sub: "Pagegroups",
        contents: {
          type: "card",
          title: req.__("Page Group settings"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
    } else {
      const { missing_screen_info_strategy } = form.values;
      await getState().setConfig(
        "missing_screen_info_strategy",
        missing_screen_info_strategy
      );
      req.flash("success", req.__("Settings saved"));
      res.redirect("/page_group/settings");
    }
  })
);

// perhaps another service to omit endless reload loops here
