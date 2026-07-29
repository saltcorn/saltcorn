/**
 * @category server
 * @module routes/pageedit
 * @subcategory routes
 */
import Router from "express-promise-router";

import View from "@saltcorn/data/models/view";
import Field from "@saltcorn/data/models/field";
import Table from "@saltcorn/data/models/table";
import Page from "@saltcorn/data/models/page";
import PageGroup from "@saltcorn/data/models/page_group";
import { div, a, iframe, script, p } from "@saltcorn/markup/tags";
import { getState } from "@saltcorn/data/db/state";
import User from "@saltcorn/data/models/user";
import Workflow from "@saltcorn/data/models/workflow";
import Form from "@saltcorn/data/models/form";
import File from "@saltcorn/data/models/file";
import Trigger from "@saltcorn/data/models/trigger";
import { getViews, traverseSync } from "@saltcorn/data/models/layout";
import _am_pack from "@saltcorn/admin-models/models/pack";
const { add_to_menu } = _am_pack;
import db from "@saltcorn/data/db";
import { getPageList, getPageGroupList } from "./common_lists.js";
import TagEntry from "@saltcorn/data/models/tag_entry";
import Tag from "@saltcorn/data/models/tag";

import {
  isAdmin,
  error_catcher,
  addOnDoneRedirect,
  is_relative_url,
  setRole,
  isAdminOrHasConfigMinRole,
} from "./utils.js";
import { asyncMap } from "@saltcorn/data/utils";
import {
  mkTable,
  renderForm,
  link,
  post_btn,
  post_delete_btn,
  post_dropdown_item,
  renderBuilder,
  settingsDropdown,
} from "@saltcorn/markup";
import { getActionConfigFields } from "@saltcorn/data/plugin-helper";
import Library from "@saltcorn/data/models/library";
import path from "path";
import { promises as fsp } from "fs";
import { FieldLike, Req, Res } from "@saltcorn/types/base_types";
import { PageCfg } from "@saltcorn/types/model-abstracts/abstract_page";
import { FieldCfg } from "@saltcorn/types/model-abstracts/abstract_field";

/**
 * @type {object}
 * @const
 * @namespace pageeditRouter
 * @category server
 * @subcategory routes
 */
const router = Router();
export default router;

/**
 *
 * @param {object} req
 * @returns {Promise<Form>}
 */
const pagePropertiesForm = async (req: Req, isNew?: any) => {
  const roles = await User.get_roles();
  const pages = (await Page.find()).map((p: any) => p.name);
  const groups = (await PageGroup.find()).map((g: any) => g.name);
  const htmlFiles = (await File.find(
    {
      mime_super: "text",
      mime_sub: "html",
      ext: "html",
    },
    { recursive: true }
  ))!;
  const htmlOptions = await asyncMap(htmlFiles, async (f: any) => {
    return {
      label: path.join(f.current_folder, f.filename),
      value: File.absPathToServePath(f.location),
    };
  });

  const form = new Form({
    action: addOnDoneRedirect("/pageedit/edit-properties", req),
    fields: [
      new Field({
        label: req.__("Name"),
        name: "name",
        required: true,
        validator(s) {
          if (s.length < 1) return req.__("Missing name");
          if (pages.includes(s) && isNew)
            return req.__("A page with this name already exists");
          if (groups.includes(s) && isNew)
            return req.__("A page group with this name already exists");
        },
        sublabel: req.__("A short name that will be in the page URL"),
        type: "String",
        attributes: { autofocus: true },
      }),
      new Field({
        label: req.__("Title"),
        name: "title",
        sublabel: req.__("Page title"),
        input_type: "text",
      }),
      new Field({
        label: req.__("Description"),
        name: "description",
        sublabel: req.__(
          "A longer description that is not visible but appears in the page header and is indexed by search engines"
        ),
        input_type: "text",
      }),
      {
        name: "min_role",
        label: req.__("Minimum role"),
        sublabel: req.__("User role required to access page"),
        input_type: "select",
        options: roles.map((r: any) => ({ value: r.id, label: r.role })),
        help: {
          topic: "Role to access",
          context: {},
        },
      },
      ...(htmlOptions.length > 0
        ? [
            {
              name: "html_file",
              label: req.__("HTML file"),
              sublabel: req.__("HTML file to use as page content"),
              input_type: "select",

              options: [
                {
                  label: req.__("None - use drag and drop builder"),
                  value: "",
                },
                ...htmlOptions,
              ],
            },
          ]
        : []),
      {
        name: "no_menu",
        label: req.__("No menu"),
        sublabel: req.__("Omit the menu from this page"),
        type: "Bool",
      },
      {
        name: "request_fluid_layout",
        label: req.__("Fluid layout"),
        sublabel: req.__(
          "Request fluid layout from theme for a wider display for this page"
        ),
        type: "Bool",
      },
    ] as FieldLike[],
  });
  return form;
};

/**
 *
 * @param {object} req
 * @param {object} context
 * @returns {Promise<object>}
 */
const pageBuilderData = async (req: Req, context: any) => {
  const views = (await View.find())!;
  const pages = (await Page.find())!;
  const page_groups = (await PageGroup.find()).map((g: any) => ({ name: g.name }));
  const images = (await File.find({ mime_super: "image" }))!;
  images.forEach((im: any) => (im.location = im.field_value));
  const roles = await User.get_roles();
  const stateActions = getState()!.actions;
  const actions = [
    "GoBack",
    ...Object.entries(stateActions)
      .filter(
        ([k, v]: any) => !v.requireRow && !v.disableInBuilder && !v.disableIf?.()
      )
      .map(([k, v]: any) => k),
  ];
  const triggers = (await Trigger.find({
    when_trigger: { or: ["API call", "Never"] },
  }))!;
  triggers.forEach((tr: any) => {
    actions.push(tr.name);
  });
  const triggerActions = Trigger.trigger_actions({
    apiNeverTriggers: true,
  });
  const actionConfigForms: Record<string, any> = {};
  const actionDescriptions: Record<string, any> = {};
  for (const name of actions) {
    const action = stateActions[name];
    if (action && action.configFields) {
      actionConfigForms[name] = await getActionConfigFields(action, null, {
        mode: "page",
        req,
      });
    }
    if (action && action.description)
      actionDescriptions[name] = action.description;
  }
  const workflowActions = Trigger.trigger_actions({
    apiNeverTriggers: true,
    onlyWorkflows: true,
  });
  for (const name of workflowActions) {
    actionConfigForms[name] = [
      {
        name: "initial_context",
        label: "Initial context",
        type: "String",
        class: "validate-expression",
      },
    ];
  }
  const actionsNotRequiringRow = Trigger.action_options({
    notRequireRow: true,
    apiNeverTriggers: true,
    forBuilder: true,
    builtInLabel: "Page Actions",
    builtIns: ["GoBack"],
  });
  const library = (await Library.find({})).filter((l: any) => l.suitableFor("page"));
  const fixed_state_fields: Record<string, any> = {};
  for (const view of views) {
    fixed_state_fields[view.name] = [];
    const table = Table.findOne(view.table_id! || view.exttable_name!)!;
    if (table) view.table_name = table.name;
    const fs = await view.get_state_fields();
    let added_fields = new Set();
    for (const frec of fs) {
      const f = new Field(frec as FieldCfg);
      if (f.input_type === "hidden") continue;
      if (f.name === "_fts") continue;

      f.required = false;
      if (f.type && f.type_name === "Bool") f.fieldview = "tristate";

      //await f.fill_fkey_options(true);
      if (added_fields.has(f.name)) continue;
      added_fields.add(f.name);
      fixed_state_fields[view.name].push(f.toBuilder);
      if (table.name === "users" && f.primary_key)
        fixed_state_fields[view.name].push(
          new Field({
            name: "preset_" + f.name,
            label: req.__("Preset %s", f.label),
            type: "String",
            attributes: { options: ["LoggedIn"] },
          }).toBuilder
        );
      if (f.presets) {
        fixed_state_fields[view.name].push(
          new Field({
            name: "preset_" + f.name,
            label: req.__("Preset %s", f.label),
            type: "String",
            attributes: { options: Object.keys(f.presets) },
          }).toBuilder
        );
      }
    }
  }
  const { on_done_redirect, ...current_filter_state } = req.query;
  //console.log(fixed_state_fields.ListTasks);
  const icons = getState()!.icons;
  return {
    isRTL: req.isRTL,
    translations:
      req.getLocale() === "en" ? {} : req.getCatalog(req.getLocale()) || {},
    views: views.map((v: any) => v.select_option),
    images,
    pages,
    page_groups,
    current_filter_state,
    actions: actionsNotRequiringRow,
    has_copilot_generate: !!getState()!.functions.copilot_generate_layout,
    has_js_copilot: !!getState()!.functions.copilot_generate_javascript,
    builtInActions: ["GoBack"],
    triggerActions,
    library,
    min_role: context.min_role,
    actionConfigForms,
    actionDescriptions,
    allowMultiStepAction: true,
    page_name: context.name,
    page_id: context.id,
    mode: "page",
    roles,
    icons,
    fixed_state_fields,
    next_button_label: "Done",
    fonts: getState()!.fonts,
    tables: [],
    keyframes: getState()!.keyframes,
  };
};

/**
 * Root pages configuration Form
 * Allows to configure root page for each role
 * Groups are listed under the pages (perhaps we need something to switch between input-selects)
 * @param {Page[]} pages list of pages
 * @param {PageGroup[]} pageGroups list of page groups
 * @param {Row[]} roles - list of roles
 * @param {any} req - request
 * @returns {Form} return Form
 */
const getRootPageForm = (pages: any, pageGroups: any, roles: any, req: Req) => {
  const form = new Form({
    action: "/pageedit/set_root_page",
    noSubmitButton: true,
    onChange: "saveAndContinue(this)",
    blurb: req.__(
      "The home page is the page that is served when the user visits the home location (/). This can be set for each user role."
    ),
    fields: roles.map(
      (r: any) =>
        new Field({
          name: r.role,
          label: r.role,
          input_type: "select",
          options: [
            r.id === 1 ? { label: req.__("Admin dashboard"), value: "" } : "",
            ...pages.filter((p: any) => p.min_role >= r.id).map((p: any) => p.name),
            ...pageGroups.map((g: any) => ({
              label: `${g.name} (group)`,
              value: g.name,
            })),
            ...(r.id === 1
              ? [
                  {
                    label: req.__("All entities list"),
                    value: "_sc_entities_list",
                  },
                ]
              : []),
          ],
        })
    ),
  });
  const modernCfg = getState()!.getConfig("home_page_by_role", false);
  for (const role of roles) {
    form.values[role.role] = modernCfg && modernCfg[role.id!];
    if (typeof form.values[role.role] !== "string")
      form.values[role.role] = getState()!.getConfig(role.role + "_home", "");
  }
  return form;
};

/**
 * @name get
 * @function
 * @memberof module:routes/pageedit~pageeditRouter
 * @function
 */
router.get(
  "/",
  isAdminOrHasConfigMinRole("min_role_edit_pages"),
  error_catcher(async (req: Req, res: Res) => {
    const pageq: Record<string, any> = {};
    let filterOnTag: any;

    if (req.query._tag) {
      const tagEntries = (await TagEntry.find({
        tag_id: +req.query._tag,
        not: { page_id: null },
      }))!;
      pageq.id = { in: tagEntries.map((te: any) => te.page_id).filter(Boolean) };
      filterOnTag = (await Tag.findOne({ id: +req.query._tag }))!;
    }
    const pages = (await Page.find(pageq, { orderBy: "name", nocase: true }))!;
    const pageGroups = (await PageGroup.find(
      {},
      { orderBy: "name", nocase: true }
    ))!;
    const roles = await User.get_roles();

    res.sendWrap(req.__("Pages"), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: req.__("Pages") }],
        },
        {
          type: "card",
          title: req.__("Your pages"),
          class: "mt-0",
          contents: div(
            await getPageList(pages, roles, req, { filterOnTag }),
            a(
              {
                href: `/pageedit/new`,
                class: "btn btn-primary",
              },
              req.__("Create page")
            )
          ),
        },
        {
          type: "card",
          title: req.__("Home pages"),
          titleAjaxIndicator: true,
          contents: renderForm(
            getRootPageForm(pages, pageGroups, roles, req),
            req.csrfToken()
          ),
        },
        {
          type: "card",
          title: req.__("Your page groups"),
          contents: div(
            p(
              req.__(
                "A group has pages with an eligible formula. " +
                  "When you request a group, then the first page where the formula matches gets served. " +
                  "This way, you can choose a page depending on the screen of the device."
              )
            ),
            getPageGroupList(pageGroups, roles, req),
            a(
              {
                href: `/page_groupedit/new`,
                class: "btn btn-primary",
              },
              req.__("Create page group")
            )
          ),
        },
      ],
    });
  })
);

/**
 * @param {*} contents
 * @param {*} noCard
 * @param {object} req
 * @param {*} page
 * @returns {*}
 */
const wrap = (contents: any, noCard: any, req: Req, page?: any) => ({
  above: [
    {
      type: "breadcrumbs",
      crumbs: [
        { text: req.__("Pages"), href: "/pageedit" },
        page
          ? { href: `/page/${encodeURIComponent(page.name)}`, text: page.name }
          : { text: req.__("New") },
      ],
      right:
        '<div id="builder-header-actions" class="d-flex align-items-center gap-2"></div>',
    },
    {
      type: noCard ? "container" : "card",
      title: page ? page.name : req.__("New"),
      titleAjaxIndicator: true,
      contents,
    },
  ],
});

/**
 * @name get/edit-properties/:pagename
 * @function
 * @memberof module:routes/pageedit~pageeditRouter
 * @function
 */
router.get(
  "/edit-properties/:pagename",
  isAdminOrHasConfigMinRole("min_role_edit_pages"),
  error_catcher(async (req: Req, res: Res) => {
    const { pagename } = req.params;
    const page = Page.findOne({ name: pagename })!;
    if (!page) {
      req.flash("error", req.__(`Page %s not found`, pagename));
      res.redirect(`/pageedit`);
    } else {
      // set fixed states in page directly for legacy builds
      const form = await pagePropertiesForm(req);
      form.hidden("id");
      form.values = page;
      form.values.no_menu = page.attributes?.no_menu;
      form.values.request_fluid_layout = page.attributes?.request_fluid_layout;
      form.onChange = `saveAndContinue(this)`;
      res.sendWrap(
        req.__(`Page attributes`),
        wrap(renderForm(form, req.csrfToken()), false, req, page)
      );
    }
  })
);

/**
 * @name get/new
 * @function
 * @memberof module:routes/pageedit~pageeditRouter
 * @function
 */
router.get(
  "/new",
  isAdminOrHasConfigMinRole("min_role_edit_pages"),
  error_catcher(async (req: Req, res: Res) => {
    const form = await pagePropertiesForm(req, true);
    res.sendWrap(
      req.__(`Page attributes`),
      wrap(renderForm(form, req.csrfToken()), false, req)
    );
  })
);

/**
 * @name post/edit-properties
 * @function
 * @memberof module:routes/pageedit~pageeditRouter
 * @function
 */
router.post(
  "/edit-properties",
  isAdminOrHasConfigMinRole("min_role_edit_pages"),
  error_catcher(async (req: Req, res: Res) => {
    const form = await pagePropertiesForm(req, !(req.body || {}).id);
    form.hidden("id");
    form.validate(req.body || {});
    if (form.hasErrors) {
      res.sendWrap(
        req.__(`Page attributes`),
        wrap(renderForm(form, req.csrfToken()), false, req)
      );
    } else {
      const {
        id,
        columns,
        no_menu,
        request_fluid_layout,
        html_file,
        ...pageRow
      } = form.values;
      pageRow.min_role = +pageRow.min_role;
      pageRow.attributes = { no_menu, request_fluid_layout };
      if (html_file) {
        pageRow.layout = {
          html_file: html_file,
        };
      }
      if (+id) {
        const dbPage = Page.findOne({ id: id })!;
        if ("html_file" in dbPage.layout && !html_file) {
          pageRow.layout = {};
        }
        await Page.update(+id, pageRow);
        await getState()!.refresh_pages();
        Trigger.emitEvent("AppChange", `Page ${dbPage.name}`, req.user, {
          entity_type: "Page",
          entity_name: dbPage.name,
        });
        if (req.xhr) res.json({ success: "ok" });
        else {
          let redirectTarget =
            req.query.on_done_redirect &&
            is_relative_url("/" + req.query.on_done_redirect)
              ? `/${req.query.on_done_redirect}`
              : "/pageedit/";
          res.redirect(redirectTarget);
        }
      } else {
        if (!pageRow.layout) pageRow.layout = {};
        if (!pageRow.fixed_states) pageRow.fixed_states = {};
        pageRow.name = pageRow.name.trim();
        await Page.create(pageRow as PageCfg);
        await getState()!.refresh_pages();
        Trigger.emitEvent("AppChange", `Page ${pageRow.name}`, req.user, {
          entity_type: "Page",
          entity_name: pageRow.name,
        });

        if (!html_file)
          res.redirect(
            addOnDoneRedirect(`/pageedit/edit/${pageRow.name}`, req)
          );
        else res.redirect(`/pageedit/`);
      }
    }
  })
);

/**
 * open the builder
 * @param {*} req
 * @param {*} res
 * @param {*} page
 */
const getEditNormalPage = async (req: Req, res: Res, page: any) => {
  // set fixed states in page directly for legacy builds
  traverseSync(page.layout, {
    view(s) {
      if (s.state === "fixed" && !s.configuration) {
        const fs = page.fixed_states[s.name];
        if (fs) s.configuration = fs;
      }
    },
  });
  const options = await pageBuilderData(req, page);
  const builderData = {
    options,
    context: page,
    layout: page.layout,
    mode: "page",
    version_tag: db.connectObj.version_tag,
  };
  res.sendWrap(
    {
      title: req.__(`%s configuration`, page.name),
      requestFluidLayout: true,
    },
    wrap(renderBuilder(builderData, req.csrfToken()), true, req, page)
  );
};

/**
 * open a file editor with an iframe preview
 * @param {*} req
 * @param {*} res
 * @param {*} page
 */
const getEditPageWithHtmlFile = async (req: Req, res: Res, page: any) => {
  const htmlFile = page.html_file;
  const iframeId = "page_preview_iframe";
  const updateBttnId = "addnUpdBtn";
  const file = (await File.findOne(htmlFile))!;
  if (!file) {
    req.flash("error", req.__("File not found"));
    return res.redirect(`/pageedit`);
  }
  const editForm = new Form({
    action: `/pageedit/edit/${encodeURIComponent(page.name)}`,
    fields: [
      {
        name: "code",
        form_name: "code",
        label: "Code",
        input_type: "code",
        attributes: { mode: "text/html" },
        validator(s) {
          return true;
        },
      },
    ],
    values: {
      code: await fsp.readFile(file.location, "utf8"),
    },
    onChange: `document.getElementById('${updateBttnId}').disabled = false;`,
    additionalButtons: [
      {
        label: req.__("Update"),
        id: updateBttnId,
        class: "btn btn-primary",
        onclick: `saveAndContinue(this, () => {
          document.getElementById('${iframeId}').contentWindow.location.reload();
          document.getElementById('${updateBttnId}').disabled = true;
        })`,
        disabled: true,
      },
    ],
    submitLabel: req.__("Finish") + " &raquo;",
  });
  res.sendWrap(req.__("Edit %s", page.title), {
    above: [
      {
        type: "card",
        title: "Edit",
        titleAjaxIndicator: true,
        contents: [renderForm(editForm, req.csrfToken())],
      },
      {
        type: "card",
        title: "Preview",
        contents: [
          iframe({
            id: iframeId,
            src: `/files/serve/${encodeURIComponent(htmlFile)}`,
          }),
          script(`
            const iframe = document.getElementById("${iframeId}");
            iframe.onload = () => {
              const _iframe = document.getElementById("${iframeId}");
              if (_iframe.contentWindow.document.body) {
                _iframe.width = _iframe.contentWindow.document.body.scrollWidth;
                _iframe.height = _iframe.contentWindow.document.body.scrollHeight;
              }
            }`),
        ],
      },
    ],
  });
};

/**
 * for normal pages, open the builder
 * for pages with a fixed html file, open a file editor with an iframe preview
 * @name get/edit/:pagename
 * @function
 * @memberof module:routes/pageedit~pageeditRouter
 * @function
 */
router.get(
  "/edit/:pagename",
  isAdminOrHasConfigMinRole("min_role_edit_pages"),
  error_catcher(async (req: Req, res: Res) => {
    const { pagename } = req.params;
    const [page] = (await Page.find({ name: pagename }))!;
    if (!page) {
      req.flash("error", req.__(`Page %s not found`, pagename));
      res.redirect(`/pageedit`);
    } else {
      if (!page.html_file) await getEditNormalPage(req, res, page);
      else await getEditPageWithHtmlFile(req, res, page);
    }
  })
);

/**
 * @name post/edit/:pagename
 * @function
 * @memberof module:routes/pageedit~pageeditRouter
 * @function
 */
router.post(
  "/edit/:pagename",
  isAdminOrHasConfigMinRole("min_role_edit_pages"),
  error_catcher(async (req: Req, res: Res) => {
    const { pagename } = req.params;

    let redirectTarget =
      req.query.on_done_redirect &&
      is_relative_url("/" + req.query.on_done_redirect)
        ? `/${req.query.on_done_redirect}`
        : "/pageedit";
    const page = (await Page.findOne({ name: pagename }))!;
    if (!page) {
      req.flash("error", req.__(`Page %s not found`, pagename));
      res.redirect(redirectTarget);
    } else if ((req.body || {}).layout) {
      await Page.update(page.id!, {
        layout: decodeURIComponent((req.body || {}).layout),
      });
      await getState()!.refresh_pages();
      Trigger.emitEvent("AppChange", `Page ${page.name}`, req.user, {
        entity_type: "Page",
        entity_name: page.name,
      });
      req.flash("success", req.__(`Page %s saved`, pagename));
      res.redirect(redirectTarget);
    } else if ((req.body || {}).code) {
      try {
        if (!page.html_file) throw new Error(req.__("File not found"));
        const file = (await File.findOne(page.html_file))!;
        if (!file) throw new Error(req.__("File not found"));
        await fsp.writeFile(file.location, (req.body || {}).code);
        Trigger.emitEvent("AppChange", `Page ${page.name}`, req.user, {
          entity_type: "Page",
          entity_name: page.name,
        });
        if (!req.xhr) {
          req.flash("success", req.__(`Page %s saved`, pagename));
          res.redirect(redirectTarget);
        } else res.json({ okay: true });
      } catch (error: any) {
        getState()!.log(2, `POST /edit/${pagename}: '${error.message}'`);
        req.flash(
          "error",
          `${req.__("Error")}: ${error.message || req.__("An error occurred")}`
        );
        if (!req.xhr) res.redirect(redirectTarget);
        else res.json({ error: error.message });
      }
    } else {
      getState()!.log(2, `POST /edit/${pagename}: '${req.body || {}}'`);
      req.flash("error", req.__(`Error processing page`));
      res.redirect(redirectTarget);
    }
    getState()!.log(5, `POST /edit/${pagename}: Success`);
  })
);

/**
 * @name post/savebuilder/:id
 * @function
 * @memberof module:routes/pageedit~pageeditRouter
 * @function
 */
router.post(
  "/savebuilder/:id",
  isAdminOrHasConfigMinRole("min_role_edit_pages"),
  error_catcher(async (req: Req, res: Res) => {
    const { id } = req.params;

    if (id && (req.body || {}).layout) {
      await Page.update(+id, { layout: (req.body || {}).layout });
      const page = (await Page.findOne({ id }))!;
      await getState()!.refresh_pages();

      Trigger.emitEvent("AppChange", `Page ${page.name}`, req.user, {
        entity_type: "Page",
        entity_name: page.name,
      });
      res.json({
        success: "ok",
      });
    } else {
      res.json({ error: req.__("Unable to save: No page or no layout") });
    }
  })
);

router.get(
  "/getlayout/:id",
  isAdminOrHasConfigMinRole("min_role_edit_pages"),
  error_catcher(async (req: Req, res: Res) => {
    const { id } = req.params;

    if (id) {
      const page = (await Page.findOne({ id }))!;
      if (!page) {
        res.json({ error: req.__("No page") });
        return;
      }
      res.json({ success: "ok", layout: page.layout });
    } else {
      res.json({ error: req.__("No view") });
    }
  })
);

/**
 * @name post/delete/:id
 * @function
 * @memberof module:routes/pageedit~pageeditRouter
 * @function
 */
router.post(
  "/delete/:id",
  isAdminOrHasConfigMinRole("min_role_edit_pages"),
  error_catcher(async (req: Req, res: Res) => {
    const { id } = req.params;
    const page = (await Page.findOne({ id }))!;
    Trigger.emitEvent("AppChange", `Page ${page.name}`, req.user, {
      entity_type: "Page",
      entity_name: page.name,
    });
    await db.withTransaction(async () => {
      await page.delete();
    });
    await getState()!.refresh_pages();
    req.flash("success", req.__(`Page deleted`));
    res.redirect(`/pageedit`);
  })
);

/**
 * @name post/set_root_page
 * @function
 * @memberof module:routes/pageedit~pageeditRouter
 * @function
 */
router.post(
  "/set_root_page",
  isAdminOrHasConfigMinRole("min_role_edit_pages"),
  error_catcher(async (req: Req, res: Res) => {
    const pages = (await Page.find({}, { orderBy: "name" }))!;
    const pageGroups = (await PageGroup.find({}, { orderBy: "name" }))!;
    const roles = await User.get_roles();
    const form = getRootPageForm(pages, pageGroups, roles, req);
    const valres = form.validate(req.body || {});
    if ("success" in valres) {
      const home_page_by_role =
        getState()!.getConfigCopy("home_page_by_role", {}) || {};
      for (const role of roles) {
        home_page_by_role[role.id!] = valres.success[role.role];
      }
      await getState()!.setConfig("home_page_by_role", home_page_by_role);
      req.flash("success", req.__(`Root pages updated`));
    } else req.flash("danger", req.__(`Error reading pages`));
    res.redirect(`/pageedit`);
  })
);

/**
 * @name post/add-to-menu/:id
 * @function
 * @memberof module:routes/pageedit~pageeditRouter
 * @function
 */
router.post(
  "/add-to-menu/:id",
  isAdminOrHasConfigMinRole("min_role_edit_pages"),
  error_catcher(async (req: Req, res: Res) => {
    const { id } = req.params;
    const page = Page.findOne({ id })!;
    await add_to_menu({
      label: page.name,
      type: "Page",
      min_role: page.min_role,
      pagename: page.name,
    });
    Trigger.emitEvent("AppChange", `Menu`, req.user, {});
    req.flash(
      "success",
      req.__(
        'Page %s added to menu. Adjust access permissions in <a href="/menu">Settings &raquo; Menu</a>',
        page.name
      )
    );
    res.redirect(`/pageedit`);
  })
);

/**
 * @name post/clone/:id
 * @function
 * @memberof module:routes/pageedit~pageeditRouter
 * @function
 */
router.post(
  "/clone/:id",
  isAdminOrHasConfigMinRole("min_role_edit_pages"),
  error_catcher(async (req: Req, res: Res) => {
    const { id } = req.params;
    const page = (await Page.findOne({ id }))!;
    const newpage = await page.clone();
    Trigger.emitEvent("AppChange", `Page ${newpage.name}`, req.user, {
      entity_type: "Page",
      entity_name: newpage.name,
    });
    await getState()!.refresh_pages();
    req.flash(
      "success",
      req.__("Page %s duplicated as %s", page.name, newpage.name)
    );
    res.redirect(`/pageedit`);
  })
);

/**
 * @name post/setrole/:id
 * @function
 * @memberof module:routes/pageedit~pageeditRouter
 * @function
 */
router.post(
  "/setrole/:id",
  isAdminOrHasConfigMinRole("min_role_edit_pages"),
  error_catcher(async (req: Req, res: Res) => {
    await setRole(req, res, Page);
  })
);
