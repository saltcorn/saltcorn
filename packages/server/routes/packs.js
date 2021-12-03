/**
 * @category server
 * @module routes/packs
 * @subcategory routes
 */

const Router = require("express-promise-router");
const { isAdmin, error_catcher } = require("./utils.js");
const { mkTable, renderForm, link, post_btn } = require("@saltcorn/markup");
const { getState } = require("@saltcorn/data/db/state");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const View = require("@saltcorn/data/models/view");
const Field = require("@saltcorn/data/models/field");
const Plugin = require("@saltcorn/data/models/plugin");
const Page = require("@saltcorn/data/models/page");
const load_plugins = require("../load_plugins");

const { is_pack } = require("@saltcorn/data/contracts");
const { contract, is } = require("contractis");
const {
  table_pack,
  view_pack,
  plugin_pack,
  page_pack,
  role_pack,
  library_pack,
  trigger_pack,
  install_pack,
  fetch_pack_by_name,
  can_install_pack,
  uninstall_pack,
} = require("@saltcorn/data/models/pack");
const { h5, pre, code, p, text, text_attr } = require("@saltcorn/markup/tags");
const Library = require("@saltcorn/data/models/library");
const Trigger = require("@saltcorn/data/models/trigger");
const Role = require("@saltcorn/data/models/role").default;

/**
 * @type {object}
 * @const
 * @namespace packsRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * @name get
 * @function
 * @memberof module:routes/packs~packsRouter
 * @function
 */
router.get(
  "/create/",
  isAdmin,
  error_catcher(async (req, res) => {
    const tables = await Table.find({});
    const tableFields = tables.map((t) => ({
      label: `${t.name} table`,
      name: `table.${t.name}`,
      type: "Bool",
    }));
    const views = await View.find({});
    const viewFields = views.map((t) => ({
      label: `${t.name} view`,
      name: `view.${t.name}`,
      type: "Bool",
    }));
    const plugins = await Plugin.find({});
    const pluginFields = plugins.map((t) => ({
      label: `${t.name} plugin`,
      name: `plugin.${t.name}`,
      type: "Bool",
    }));
    const pages = await Page.find({});
    const pageFields = pages.map((t) => ({
      label: `${t.name} page`,
      name: `page.${t.name}`,
      type: "Bool",
    }));
    const libs = await Library.find({});
    const libFields = libs.map((l) => ({
      label: `${l.name} library item`,
      name: `library.${l.name}`,
      type: "Bool",
    }));
    const trigs = await Trigger.find({});
    const trigFields = trigs.map((l) => ({
      label: `${l.name} trigger`,
      name: `trigger.${l.name}`,
      type: "Bool",
    }));
    const roles = await Role.find({ not: { id: { in: [1, 8, 10] } } });
    const roleFields = roles.map((l) => ({
      label: `${l.role} role`,
      name: `role.${l.role}`,
      type: "Bool",
    }));
    const form = new Form({
      action: "/packs/create",
      fields: [
        ...tableFields,
        ...viewFields,
        ...pluginFields,
        ...pageFields,
        ...trigFields,
        ...roleFields,
        ...libFields,
      ],
    });
    res.sendWrap(req.__(`Create Pack`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Settings") },
            { text: req.__("Plugins"), href: "/plugins" },
            { text: req.__("Create pack") },
          ],
        },
        {
          type: "card",
          title: req.__(`Create pack`),
          contents: renderForm(form, req.csrfToken()),
        },
      ],
    });
  })
);

/**
 * @name post/create
 * @function
 * @memberof module:routes/packs~packsRouter
 * @function
 */
router.post(
  "/create",
  isAdmin,
  error_catcher(async (req, res) => {
    var pack = {
      tables: [],
      views: [],
      plugins: [],
      pages: [],
      roles: [],
      library: [],
      triggers: [],
    };
    for (const k of Object.keys(req.body)) {
      const [type, name] = k.split(".");
      switch (type) {
        case "table":
          pack.tables.push(await table_pack(name));
          break;
        case "view":
          pack.views.push(await view_pack(name));
          break;
        case "plugin":
          pack.plugins.push(await plugin_pack(name));
          break;
        case "page":
          pack.pages.push(await page_pack(name));
          break;
        case "library":
          pack.library.push(await library_pack(name));
          break;
        case "role":
          pack.roles.push(await role_pack(name));
          break;
        case "trigger":
          pack.triggers.push(await trigger_pack(name));
          break;

        default:
          break;
      }
    }
    res.sendWrap(req.__(`Pack`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Settings") },
            { text: req.__("Plugins"), href: "/plugins" },
            { text: req.__("Create pack") },
          ],
        },
        {
          type: "card",
          title: req.__(`Pack`),
          contents: [
            p(
              req.__(
                "You can copy the pack contents below to another Saltcorn installation."
              )
            ),
            pre(
              { class: "pack-display" },
              code(text_attr(JSON.stringify(pack)))
            ),
          ],
        },
      ],
    });
  })
);

/**
 * @param {object} req
 * @returns {Form}
 */
const install_pack_form = (req) =>
  new Form({
    action: "/packs/install",
    submitLabel: req.__("Install"),
    fields: [
      {
        name: "pack",
        label: req.__("Pack"),
        type: "String",
        fieldview: "textarea",
      },
    ],
  });

/**
 * @name get/install
 * @function
 * @memberof module:routes/packs~packsRouter
 * @function
 */
router.get(
  "/install",
  isAdmin,
  error_catcher(async (req, res) => {
    res.sendWrap(req.__(`Install Pack`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Settings") },
            { text: req.__("Plugins"), href: "/plugins" },
            { text: req.__("Install pack") },
          ],
        },
        {
          type: "card",
          title: req.__(`Install Pack`),
          contents: renderForm(install_pack_form(req), req.csrfToken()),
        },
      ],
    });
  })
);

/**
 * @name post/install
 * @function
 * @memberof module:routes/packs~packsRouter
 * @function
 */
router.post(
  "/install",
  isAdmin,
  error_catcher(async (req, res) => {
    var pack, error;
    try {
      pack = JSON.parse(req.body.pack);
    } catch (e) {
      error = e.message;
    }
    if (!error && !is_pack.check(pack)) {
      error = req.__("Not a valid pack");
    }
    if (!error) {
      const can_install = await can_install_pack(pack);
      if (can_install.error) {
        error = can_install.error;
      } else if (can_install.warning) {
        req.flash("warning", can_install.warning);
      }
    }
    if (error) {
      const form = install_pack_form(req);
      form.values = { pack: req.body.pack };
      req.flash("error", error);
      res.sendWrap(req.__(`Install Pack`), {
        above: [
          {
            type: "breadcrumbs",
            crumbs: [
              { text: req.__("Settings") },
              { text: req.__("Plugins"), href: "/plugins" },
              { text: req.__("Install pack") },
            ],
          },
          {
            type: "card",
            title: req.__(`Install Pack`),
            contents: renderForm(form, req.csrfToken()),
          },
        ],
      });
    } else {
      await install_pack(pack, undefined, (p) =>
        load_plugins.loadAndSaveNewPlugin(p)
      );

      res.redirect(`/`);
    }
  })
);

/**
 * @name post/install-named/:name
 * @function
 * @memberof module:routes/packs~packsRouter
 * @function
 */
router.post(
  "/install-named/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;

    const pack = await fetch_pack_by_name(name);
    if (!pack) {
      req.flash("error", req.__(`Pack %s not found`, text(name)));
      res.redirect(`/plugins`);
      return;
    }
    const can_install = await can_install_pack(pack.pack);

    if (can_install.error) {
      error = can_install.error;
      req.flash("error", error);
      res.redirect(`/plugins`);
      return;
    } else if (can_install.warning) {
      req.flash("warning", can_install.warning);
    }
    await install_pack(pack.pack, name, (p) =>
      load_plugins.loadAndSaveNewPlugin(p)
    );
    req.flash("success", req.__(`Pack %s installed`, text(name)));
    res.redirect(`/`);
  })
);

/**
 * @name post/uninstall/:name
 * @function
 * @memberof module:routes/packs~packsRouter
 * @function
 */
router.post(
  "/uninstall/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;

    const pack = await fetch_pack_by_name(name);
    if (!pack) {
      req.flash("error", req.__(`Pack %s not found`, text(name)));
      res.redirect(`/plugins`);
      return;
    }
    await uninstall_pack(pack.pack, name);

    req.flash("success", req.__(`Pack %s uninstalled`, text(name)));

    res.redirect(`/`);
  })
);
