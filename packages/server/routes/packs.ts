/**
 * @category server
 * @module routes/packs
 * @subcategory routes
 */

import Router from "express-promise-router";
import { isAdmin, error_catcher, setTenant, is_relative_url } from "./utils.js";
import { renderForm } from "@saltcorn/markup";
import Table from "@saltcorn/data/models/table";
import Form from "@saltcorn/data/models/form";
import View from "@saltcorn/data/models/view";
import Plugin from "@saltcorn/data/models/plugin";
import Page from "@saltcorn/data/models/page";
import PageGroup from "@saltcorn/data/models/page_group";
import Tag from "@saltcorn/data/models/tag";
import EventLog from "@saltcorn/data/models/eventlog";
import Model from "@saltcorn/data/models/model";
import ModelInstance from "@saltcorn/data/models/model_instance";
import { getState } from "@saltcorn/data/db/state";
import db from "@saltcorn/data/db/index";
import { instanceOfPack } from "@saltcorn/types/base_types";

import _am_pack from "@saltcorn/admin-models/models/pack";
const {
  table_pack,
  view_pack,
  plugin_pack,
  page_pack,
  page_group_pack,
  role_pack,
  library_pack,
  trigger_pack,
  tag_pack,
  model_pack,
  model_instance_pack,
  install_pack,
  fetch_pack_by_name,
  can_install_pack,
  uninstall_pack,
  event_log_pack,
} = _am_pack;
import { pre, code, p, text, text_attr } from "@saltcorn/markup/tags";
import Library from "@saltcorn/data/models/library";
import Trigger from "@saltcorn/data/models/trigger";
import Role from "@saltcorn/data/models/role";
import fs from "fs";

/**
 * @type {object}
 * @const
 * @namespace packsRouter
 * @category server
 * @subcategory routes
 */
const router = Router();
export default router;

const getOnDoneRedirect = (req: any, fallback: any = "/plugins") => {
  if (
    req.query.on_done_redirect &&
    is_relative_url("/" + req.query.on_done_redirect)
  ) {
    return `/${req.query.on_done_redirect}`;
  }
  return fallback;
};

/**
 * @name get
 * @function
 * @memberof module:routes/packs~packsRouter
 * @function
 */
router.get(
  "/create/",
  isAdmin,
  error_catcher(async (req: Req, res: Res) => {
    const tables = await Table.find({});
    const tableFields = tables.map((t: any) => ({
      label: `${t.name} table`,
      name: `table.${t.name}`,
      type: "Bool",
    }));
    const views = await View.find({});
    const viewFields = views.map((t: any) => ({
      label: `${t.name} view`,
      name: `view.${t.name}`,
      type: "Bool",
    }));
    const plugins = await Plugin.find({});
    const pluginFields = plugins.map((t: any) => ({
      label: `${t.name} plugin`,
      name: `plugin.${t.name}`,
      type: "Bool",
    }));
    const pages = await Page.find({});
    const pageFields = pages.map((t: any) => ({
      label: `${t.name} page`,
      name: `page.${t.name}`,
      type: "Bool",
    }));
    const pageGroups = await PageGroup.find({});
    const pageGroupFields = pageGroups.map((t: any) => ({
      label: `${t.name} page group`,
      name: `page_group.${t.name}`,
      type: "Bool",
    }));
    const libs = await Library.find({});
    const libFields = libs.map((l: any) => ({
      label: `${l.name} library item`,
      name: `library.${l.name}`,
      type: "Bool",
    }));
    const trigs = await Trigger.find({});
    const trigFields = trigs.map((l: any) => ({
      label: `${l.name} trigger`,
      name: `trigger.${l.name}`,
      type: "Bool",
    }));
    const roles = await Role.find({ not: { id: { in: [1, 8, 10] } } });
    const roleFields = roles.map((l: any) => ({
      label: `${l.role} role`,
      name: `role.${l.role}`,
      type: "Bool",
    }));
    const tags = await Tag.find({});
    const tagFields = tags.map((t: any) => ({
      label: `${t.name} tag`,
      name: `tag.${t.name}`,
      type: "Bool",
    }));
    const models = await Model.find({});
    const modelFields = models.map((m: any) => {
      const modelTbl = Table.findOne({ id: m.table_id });
      return {
        label: `${m.name} model, table: ${
          modelTbl.name || req.__("Table not found")
        }`,
        name: `model.${m.name}.${modelTbl.name}`,
        type: "Bool",
      };
    });
    const modelInstances = await ModelInstance.find({});
    const modelInstanceFields = (
      await Promise.all(
        modelInstances.map(async (instance: any) => {
          const model = await Model.findOne({ id: instance.model_id });
          if (!model) {
            req.flash(
              "warning",
              req.__(`Model with '${instance.model_id}' not found`)
            );
            return null;
          }
          const mTable = await Table.findOne({ id: model.table_id });
          if (!mTable) {
            req.flash(
              "warning",
              req.__(`Table of model '${model.name}' not found`)
            );
            return null;
          }
          return {
            label: `${instance.name} model instance, model: ${model.name}, table: ${mTable.name}`,
            name: `model_instance.${instance.name}.${model.name}.${mTable.name}`,
            type: "Bool",
          };
        })
      )
    ).filter((f: any) => f);

    const form = new Form({
      action: "/packs/create",
      fields: [
        ...tableFields,
        ...viewFields,
        ...pluginFields,
        ...pageFields,
        ...pageGroupFields,
        ...trigFields,
        ...roleFields,
        ...libFields,
        ...tagFields,
        ...modelFields,
        ...modelInstanceFields,
        {
          name: "with_event_logs",
          label: req.__("Include Event Logs"),
          type: "Bool",
        },
      ],
    });
    res.sendWrap(req.__(`Create Pack`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Settings") },
            { text: req.__("Modules"), href: "/plugins" },
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
  error_catcher(async (req: Req, res: Res) => {
    const pack = {
      tables: [],
      views: [],
      plugins: [],
      pages: [],
      page_groups: [],
      roles: [],
      library: [],
      triggers: [],
      tags: [],
      models: [],
      model_instances: [],
      event_logs: [],
    };
    for (const k of Object.keys(req.body || {})) {
      const [type, name, ...rest] = k.split(".");
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
        case "page_group":
          pack.page_groups.push(await page_group_pack(name));
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
        case "tag":
          pack.tags.push(await tag_pack(name));
          break;
        case "model": {
          const table = rest[0];
          if (!table) throw new Error(`Table for model '${name}' not found`);
          pack.models.push(await model_pack(name, table));
          break;
        }
        case "model_instance": {
          const model = rest[0];
          if (!model)
            throw new Error(`Model of Model Instance '${name}' not found`);
          const table = rest[1];
          if (!table) throw new Error(`Table of Model '${model}' not found`);
          pack.model_instances.push(
            await model_instance_pack(name, model, table)
          );
          break;
        }
        case "with_event_logs":
          const logs = await EventLog.find({});
          pack.event_logs = await Promise.all(
            logs.map(async (l: any) => await event_log_pack(l))
          );
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
            { text: req.__("Modules"), href: "/plugins" },
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
const install_pack_form = (req: any) =>
  new Form({
    action: "/packs/install",
    submitLabel: req.__("Install"),
    fields: [
      {
        name: "source",
        label: req.__("Source"),
        type: "String",
        attributes: {
          options: [
            { label: "from text", name: "from_text" },
            { label: "from file", name: "from_file" },
          ],
        },
        default: "from_text",
        required: true,
      },
      {
        name: "pack",
        label: req.__("Pack"),
        type: "String",
        fieldview: "textarea",
        showIf: { source: "from_text" },
      },
      {
        name: "pack_file",
        label: req.__("Pack file"),
        class: "form-control",
        type: "File",
        sublabel: req.__("Upload a pack file"),
        showIf: { source: "from_file" },
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
  error_catcher(async (req: Req, res: Res) => {
    res.sendWrap(req.__(`Install Pack`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Settings") },
            { text: req.__("Modules"), href: "/plugins" },
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
  setTenant, // TODO why is this needed?????
  isAdmin,
  error_catcher(async (req: Req, res: Res) => {
    var pack, error;
    const source = (req.body || {}).source || "from_text";
    try {
      switch (source) {
        case "from_text":
          pack = JSON.parse((req.body || {}).pack);
          break;
        case "from_file":
          if (req.files?.pack_file?.tempFilePath)
            pack = JSON.parse(
              fs.readFileSync(req.files?.pack_file?.tempFilePath)
            );
          else throw new Error(req.__("No file uploaded"));
          break;
        default:
          throw new Error(req.__("Invalid source"));
      }
    } catch (e: any) {
      error = e.message;
    }
    if (!error && !instanceOfPack(pack)) {
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
      form.values = { pack: (req.body || {}).pack };
      req.flash("error", error);
      res.sendWrap(req.__(`Install Pack`), {
        above: [
          {
            type: "breadcrumbs",
            crumbs: [
              { text: req.__("Settings") },
              { text: req.__("Modules"), href: "/plugins" },
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
      await db.withTransaction(async () => {
        await install_pack(pack, undefined, (p: any) =>
          Plugin.loadAndSaveNewPlugin(p)
        );
      });
      await getState()!.refresh();
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
  error_catcher(async (req: Req, res: Res) => {
    const { name } = req.params;

    const pack = await fetch_pack_by_name(name);
    if (!pack) {
      req.flash("error", req.__(`Pack %s not found`, text(name)));
      res.redirect(getOnDoneRedirect(req, "/plugins"));
      return;
    }
    const can_install = await can_install_pack(pack.pack);

    if (can_install.error) {
      req.flash("error", can_install.error);
      res.redirect(getOnDoneRedirect(req, "/plugins"));
      return;
    } else if (can_install.warning) {
      req.flash("warning", can_install.warning);
    }
    await db.withTransaction(async () => {
      await install_pack(pack.pack, name, (p: any) =>
        Plugin.loadAndSaveNewPlugin(p)
      );
    });
    await getState()!.refresh();
    req.flash("success", req.__(`Pack %s installed`, text(name)));
    res.redirect(getOnDoneRedirect(req, "/"));
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
  error_catcher(async (req: Req, res: Res) => {
    const { name } = req.params;

    const pack = await fetch_pack_by_name(name);
    if (!pack) {
      req.flash("error", req.__(`Pack %s not found`, text(name)));
      res.redirect(getOnDoneRedirect(req, "/plugins"));
      return;
    }
    await db.withTransaction(async () => {
      await uninstall_pack(pack.pack, name);
    });
    await getState()!.refresh();

    req.flash("success", req.__(`Pack %s uninstalled`, text(name)));

    res.redirect(getOnDoneRedirect(req, "/"));
  })
);
