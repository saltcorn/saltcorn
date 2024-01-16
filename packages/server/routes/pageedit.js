/**
 * @category server
 * @module routes/pageedit
 * @subcategory routes
 */
const Router = require("express-promise-router");

const View = require("@saltcorn/data/models/view");
const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Page = require("@saltcorn/data/models/page");
const PageGroup = require("@saltcorn/data/models/page_group");
const { div, a, iframe, script, p } = require("@saltcorn/markup/tags");
const { getState } = require("@saltcorn/data/db/state");
const User = require("@saltcorn/data/models/user");
const Workflow = require("@saltcorn/data/models/workflow");
const Form = require("@saltcorn/data/models/form");
const File = require("@saltcorn/data/models/file");
const Trigger = require("@saltcorn/data/models/trigger");
const { getViews, traverseSync } = require("@saltcorn/data/models/layout");
const { add_to_menu } = require("@saltcorn/admin-models/models/pack");
const db = require("@saltcorn/data/db");
const { getPageList, getPageGroupList } = require("./common_lists");

const {
  isAdmin,
  error_catcher,
  addOnDoneRedirect,
  is_relative_url,
  setRole,
} = require("./utils.js");
const { asyncMap } = require("@saltcorn/data/utils");
const {
  mkTable,
  renderForm,
  link,
  post_btn,
  post_delete_btn,
  post_dropdown_item,
  renderBuilder,
  settingsDropdown,
} = require("@saltcorn/markup");
const { getActionConfigFields } = require("@saltcorn/data/plugin-helper");
const Library = require("@saltcorn/data/models/library");
const path = require("path");
const fsp = require("fs").promises;

/**
 * @type {object}
 * @const
 * @namespace pageeditRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 *
 * @param {object} req
 * @returns {Promise<Form>}
 */
const pagePropertiesForm = async (req, isNew) => {
  const roles = await User.get_roles();
  const pages = (await Page.find()).map((p) => p.name);
  const groups = (await PageGroup.find()).map((g) => g.name);
  const htmlFiles = await File.find(
    {
      mime_super: "text",
      mime_sub: "html",
    },
    { recursive: true }
  );
  const htmlOptions = await asyncMap(htmlFiles, async (f) => {
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
        sublabel: req.__("A short name that will be in your URL"),
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
        sublabel: req.__("A longer description"),
        input_type: "text",
      }),
      {
        name: "min_role",
        label: req.__("Minimum role"),
        sublabel: req.__("Role required to access page"),
        input_type: "select",
        options: roles.map((r) => ({ value: r.id, label: r.role })),
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
    ],
  });
  return form;
};

/**
 *
 * @param {object} req
 * @param {object} context
 * @returns {Promise<object>}
 */
const pageBuilderData = async (req, context) => {
  const views = await View.find();
  const pages = await Page.find();
  const page_groups = (await PageGroup.find()).map((g) => ({ name: g.name }));
  const images = await File.find({ mime_super: "image" });
  images.forEach((im) => (im.location = im.path_to_serve));
  const roles = await User.get_roles();
  const stateActions = getState().actions;
  const actions = [
    "GoBack",
    ...Object.entries(stateActions)
      .filter(([k, v]) => !v.requireRow && !v.disableInBuilder)
      .map(([k, v]) => k),
  ];
  const triggers = await Trigger.find({
    when_trigger: { or: ["API call", "Never"] },
  });
  triggers.forEach((tr) => {
    actions.push(tr.name);
  });
  const actionConfigForms = {};
  for (const name of actions) {
    const action = stateActions[name];
    if (action && action.configFields) {
      actionConfigForms[name] = await getActionConfigFields(action, null, {
        mode: "page",
      });
    }
  }
  const library = (await Library.find({})).filter((l) => l.suitableFor("page"));
  const fixed_state_fields = {};
  for (const view of views) {
    fixed_state_fields[view.name] = [];
    const table = Table.findOne(view.table_id || view.exttable_name);

    const fs = await view.get_state_fields();
    for (const frec of fs) {
      const f = new Field(frec);
      if (f.input_type === "hidden") continue;
      if (f.name === "_fts") continue;

      f.required = false;
      if (f.type && f.type.name === "Bool") f.fieldview = "tristate";

      await f.fill_fkey_options(true);
      fixed_state_fields[view.name].push(f);
      if (table.name === "users" && f.primary_key)
        fixed_state_fields[view.name].push(
          new Field({
            name: "preset_" + f.name,
            label: req.__("Preset %s", f.label),
            type: "String",
            attributes: { options: ["LoggedIn"] },
          })
        );
      if (f.presets) {
        fixed_state_fields[view.name].push(
          new Field({
            name: "preset_" + f.name,
            label: req.__("Preset %s", f.label),
            type: "String",
            attributes: { options: Object.keys(f.presets) },
          })
        );
      }
    }
  }
  //console.log(fixed_state_fields.ListTasks);
  return {
    views,
    images,
    pages,
    page_groups,
    actions,
    builtInActions: ["GoBack"],
    library,
    min_role: context.min_role,
    actionConfigForms,
    allowMultiStepAction: true,
    page_name: context.name,
    page_id: context.id,
    mode: "page",
    roles,
    fixed_state_fields,
    next_button_label: "Done",
    fonts: getState().fonts,
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
const getRootPageForm = (pages, pageGroups, roles, req) => {
  const form = new Form({
    action: "/pageedit/set_root_page",
    noSubmitButton: true,
    onChange: "saveAndContinue(this)",
    blurb: req.__(
      "The root page is the page that is served when the user visits the home location (/). This can be set for each user role."
    ),
    fields: roles.map(
      (r) =>
        new Field({
          name: r.role,
          label: r.role,
          input_type: "select",
          options: [
            "",
            ...pages.map((p) => p.name),
            ...pageGroups.map((g) => ({
              label: `${g.name} (group)`,
              value: g.name,
            })),
          ],
        })
    ),
  });
  const modernCfg = getState().getConfig("home_page_by_role", false);
  for (const role of roles) {
    form.values[role.role] = modernCfg && modernCfg[role.id];
    if (typeof form.values[role.role] !== "string")
      form.values[role.role] = getState().getConfig(role.role + "_home", "");
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
  isAdmin,
  error_catcher(async (req, res) => {
    const pages = await Page.find({}, { orderBy: "name", nocase: true });
    const pageGroups = await PageGroup.find(
      {},
      { orderBy: "name", nocase: true }
    );
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
            getPageList(pages, roles, req),
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
        {
          type: "card",
          title: req.__("Root pages"),
          titleAjaxIndicator: true,
          contents: renderForm(
            getRootPageForm(pages, pageGroups, roles, req),
            req.csrfToken()
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
const wrap = (contents, noCard, req, page) => ({
  above: [
    {
      type: "breadcrumbs",
      crumbs: [
        { text: req.__("Pages"), href: "/pageedit" },
        page
          ? { href: `/page/${page.name}`, text: page.name }
          : { text: req.__("New") },
      ],
    },
    {
      type: noCard ? "container" : "card",
      title: page ? page.name : req.__("New"),
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
  isAdmin,
  error_catcher(async (req, res) => {
    const { pagename } = req.params;
    const page = Page.findOne({ name: pagename });
    if (!page) {
      req.flash("error", req.__(`Page %s not found`, pagename));
      res.redirect(`/pageedit`);
    } else {
      // set fixed states in page directly for legacy builds
      const form = await pagePropertiesForm(req);
      form.hidden("id");
      form.values = page;
      form.values.no_menu = page.attributes?.no_menu;
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
  isAdmin,
  error_catcher(async (req, res) => {
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
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await pagePropertiesForm(req, !req.body.id);
    form.hidden("id");
    form.validate(req.body);
    if (form.hasErrors) {
      res.sendWrap(
        req.__(`Page attributes`),
        wrap(renderForm(form, req.csrfToken()), false, req)
      );
    } else {
      const { id, columns, no_menu, html_file, ...pageRow } = form.values;
      pageRow.min_role = +pageRow.min_role;
      pageRow.attributes = { no_menu };
      if (html_file) {
        pageRow.layout = {
          html_file: html_file,
        };
      }
      if (+id) {
        const dbPage = Page.findOne({ id: id });
        if (dbPage.layout?.html_file && !html_file) {
          pageRow.layout = {};
        }
        await Page.update(+id, pageRow);
        res.redirect(`/pageedit/`);
      } else {
        if (!pageRow.layout) pageRow.layout = {};
        if (!pageRow.fixed_states) pageRow.fixed_states = {};
        await Page.create(pageRow);
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
const getEditNormalPage = async (req, res, page) => {
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
    req.__(`%s configuration`, page.name),
    wrap(renderBuilder(builderData, req.csrfToken()), true, req, page)
  );
};

/**
 * open a file editor with an iframe preview
 * @param {*} req
 * @param {*} res
 * @param {*} page
 */
const getEditPageWithHtmlFile = async (req, res, page) => {
  const htmlFile = page.html_file;
  const iframeId = "page_preview_iframe";
  const updateBttnId = "addnUpdBtn";
  const file = await File.findOne(htmlFile);
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
  isAdmin,
  error_catcher(async (req, res) => {
    const { pagename } = req.params;
    const [page] = await Page.find({ name: pagename });
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
  isAdmin,
  error_catcher(async (req, res) => {
    const { pagename } = req.params;

    let redirectTarget =
      req.query.on_done_redirect && is_relative_url(req.query.on_done_redirect)
        ? `/${req.query.on_done_redirect}`
        : "/pageedit";
    const page = await Page.findOne({ name: pagename });
    if (!page) {
      req.flash("error", req.__(`Page %s not found`, pagename));
      res.redirect(redirectTarget);
    } else if (req.body.layout) {
      await Page.update(page.id, {
        layout: decodeURIComponent(req.body.layout),
      });
      req.flash("success", req.__(`Page %s saved`, pagename));
      res.redirect(redirectTarget);
    } else if (req.body.code) {
      try {
        if (!page.html_file) throw new Error(req.__("File not found"));
        const file = await File.findOne(page.html_file);
        if (!file) throw new Error(req.__("File not found"));
        await fsp.writeFile(file.location, req.body.code);
        if (!req.xhr) {
          req.flash("success", req.__(`Page %s saved`, pagename));
          res.redirect(redirectTarget);
        } else res.json({ okay: true });
      } catch (error) {
        getState().log(2, `POST /edit/${pagename}: '${error.message}'`);
        req.flash(
          "error",
          `${req.__("Error")}: ${error.message || req.__("An error occurred")}`
        );
        if (!req.xhr) res.redirect(redirectTarget);
        else res.json({ error: error.message });
      }
    } else {
      getState().log(2, `POST /edit/${pagename}: '${req.body}'`);
      req.flash("error", req.__(`Error processing page`));
      res.redirect(redirectTarget);
    }
    getState().log(5, `POST /edit/${pagename}: Success`);
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
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;

    if (id && req.body.layout) {
      await Page.update(+id, { layout: req.body.layout });
      res.json({ success: "ok" });
    } else {
      res.json({ error: "no page or no layout." });
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
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const page = await Page.findOne({ id });
    await page.delete();
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
  isAdmin,
  error_catcher(async (req, res) => {
    const pages = await Page.find({}, { orderBy: "name" });
    const pageGroups = await PageGroup.find(
      {},
      { orderBy: "name", nocase: true }
    );
    const roles = await User.get_roles();
    const form = getRootPageForm(pages, pageGroups, roles, req);
    const valres = form.validate(req.body);
    if (valres.success) {
      const home_page_by_role =
        getState().getConfigCopy("home_page_by_role", {}) || {};
      for (const role of roles) {
        home_page_by_role[role.id] = valres.success[role.role];
      }
      await getState().setConfig("home_page_by_role", home_page_by_role);
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
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const page = Page.findOne({ id });
    await add_to_menu({
      label: page.name,
      type: "Page",
      min_role: page.min_role,
      pagename: page.name,
    });
    req.flash(
      "success",
      req.__(
        "Page %s added to menu. Adjust access permissions in Settings &raquo; Menu",
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
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const page = await Page.findOne({ id });
    const newpage = await page.clone();
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
  isAdmin,
  error_catcher(async (req, res) => {
    await setRole(req, res, Page);
  })
);
