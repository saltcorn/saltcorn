const Router = require("express-promise-router");
const { isAdmin, setTenant, error_catcher } = require("./utils.js");
const { getState } = require("@saltcorn/data/db/state");
const Trigger = require("@saltcorn/data/models/trigger");

const router = new Router();
module.exports = router;
const {
  mkTable,
  renderForm,
  link,
  post_btn,
  settingsDropdown,
  post_dropdown_item,
  post_delete_btn,
} = require("@saltcorn/markup");
const actions = require("@saltcorn/data/base-plugin/actions");
const Form = require("@saltcorn/data/models/form");
const { div, code, a, span } = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const { getActionConfigFields } = require("@saltcorn/data/plugin-helper");

const wrap = (req, cardTitle, response, lastBc) => ({
  above: [
    {
      type: "breadcrumbs",
      crumbs: [
        { text: req.__("Settings") },
        { text: req.__("Actions"), href: lastBc && "/actions" },
        ...(lastBc ? [lastBc] : []),
      ],
    },
    ...response,
  ],
});
const getActions = async () => {
  return Object.entries(getState().actions).map(([k, v]) => {
    const hasConfig = !!v.configFields;
    return {
      name: k,
      hasConfig,
    };
  });
};
router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const triggers = await Trigger.findAllWithTableName();
    const actions = await getActions();
    res.sendWrap(
      req.__("Actions"),
      wrap(req, req.__("Actions"), [
        {
          type: "card",
          title: req.__("Actions available"),
          contents: div(
            actions
              .map((a) => span({ class: "badge badge-primary" }, a.name))
              .join("&nbsp;")
          ),
        },
        {
          type: "card",
          title: req.__("Triggers"),
          contents: div(
            mkTable(
              [
                { label: req.__("Name"), key: "name" },
                { label: req.__("Action"), key: "action" },
                { label: req.__("Table"), key: "table_name" },
                { label: req.__("When"), key: "when_trigger" },
                {
                  label: req.__("Test run"),
                  key: (r) =>
                    r.table_id
                      ? ""
                      : link(`/actions/testrun/${r.id}`, req.__("Test run")),
                },
                {
                  label: req.__("Configure"),
                  key: (r) =>
                    link(`/actions/configure/${r.id}`, req.__("Configure")),
                },
                {
                  label: req.__("Delete"),
                  key: (r) => post_delete_btn(`/actions/delete/${r.id}`, req),
                },
              ],
              triggers
            ),
            link("/actions/trigger/new", req.__("Add trigger"))
          ),
        },
      ])
    );
  })
);
const triggerForm = async (req, trigger) => {
  const actions = await getActions();
  const tables = await Table.find({});
  const form = new Form({
    action: "/actions/trigger",
    fields: [
      {
        name: "name",
        label: req.__("Name"),
        type: "String",
      },
      {
        name: "action",
        label: req.__("Action"),
        input_type: "select",
        required: true,
        options: actions.map((t) => ({ value: t.name, label: t.name })),
      },
      {
        name: "when_trigger",
        label: req.__("When"),
        input_type: "select",
        class: "whentrig",
        required: true,
        options: Trigger.when_options.map((t) => ({ value: t, label: t })),
      },
      {
        name: "table_id",
        label: req.__("Table"),
        input_type: "select",
        options: [...tables.map((t) => ({ value: t.id, label: t.name }))],
        showIf: { ".whentrig": ["Insert", "Update", "Delete"] },
      },
    ],
  });
  if (trigger) {
    form.hidden("id");
    form.values = trigger;
  }
  return form;
};
router.get(
  "/trigger/new",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await triggerForm(req);
    res.sendWrap(
      req.__("New trigger"),
      wrap(
        req,
        req.__("New trigger"),
        [
          {
            type: "card",
            title: req.__("New trigger"),
            contents: renderForm(form, req.csrfToken()),
          },
        ],
        {
          text: req.__("New trigger"),
        }
      )
    );
  })
);

router.get(
  "/trigger/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });

    const form = await triggerForm(req, trigger);
    res.sendWrap(
      req.__("Edit trigger"),
      wrap(
        req,
        req.__("Edit trigger"),
        [
          {
            type: "card",
            title: req.__("Edit trigger"),
            contents: renderForm(form, req.csrfToken()),
          },
        ],
        {
          text: req.__("Edit trigger"),
        }
      )
    );
  })
);

router.post(
  "/trigger",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await triggerForm(req);
    form.validate(req.body);
    if (form.hasErrors) {
      res.sendWrap(
        req.__("Edit trigger"),
        wrap(
          req,
          req.__("Edit trigger"),
          [
            {
              type: "card",
              title: req.__("Edit trigger"),
              contents: renderForm(form, req.csrfToken()),
            },
          ],
          {
            text: req.__("Edit trigger"),
          }
        )
      );
    } else {
      let id;
      if (form.values.id) {
        id = form.values.id;
        await Trigger.update(id, form.values);
      } else {
        const tr = await Trigger.create(form.values);
        id = tr.id;
      }
      res.redirect(`/actions/configure/${id}`);
    }
  })
);
router.get(
  "/configure/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });
    const action = getState().actions[trigger.action];
    if (!action) {
      req.flash("warning", "Action not found");
      res.redirect(`/actions/`);
    } else if (!action.configFields) {
      req.flash("warning", "Action not configurable");
      res.redirect(`/actions/`);
    } else {
      const table = trigger.table_id
        ? await Table.findOne({ id: trigger.table_id })
        : null;
      const cfgFields = await getActionConfigFields(action, table);
      const form = new Form({
        action: `/actions/configure/${id}`,
        fields: cfgFields,
      });
      form.values = trigger.configuration;
      res.sendWrap(
        req.__("Configure trigger"),
        wrap(
          req,
          req.__("Configure trigger"),
          [
            {
              type: "card",
              title: req.__("Configure trigger"),
              contents: renderForm(form, req.csrfToken()),
            },
          ],
          {
            text: req.__("Configure trigger"),
          }
        )
      );
    }
  })
);
router.post(
  "/configure/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });
    const action = getState().actions[trigger.action];
    const table = trigger.table_id
      ? await Table.findOne({ id: trigger.table_id })
      : null;
    const cfgFields = await getActionConfigFields(action, table);
    const form = new Form({
      action: `/actions/configure/${id}`,
      fields: cfgFields,
    });
    form.validate(req.body);
    if (form.hasErrors) {
      res.sendWrap(
        req.__("Configure trigger"),
        wrap(
          req,
          req.__("Configure trigger"),
          [
            {
              type: "card",
              title: req.__("Configure trigger"),
              contents: renderForm(form, req.csrfToken()),
            },
          ],
          {
            text: req.__("Configure trigger"),
          }
        )
      );
    } else {
      await Trigger.update(trigger.id, { configuration: form.values });
      req.flash("success", "Action configuration saved");
      res.redirect(`/actions/`);
    }
  })
);
router.post(
  "/delete/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });
    await trigger.delete();
    res.redirect(`/actions/`);
  })
);
router.get(
  "/testrun/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });
    const output = [];
    const fakeConsole = {
      log(...s) {
        output.push(div(code(s.join(" "))));
      },
      error(...s) {
        output.push(
          div(code({ style: "color:red;font-weight:bold;" }, s.join(" ")))
        );
      },
    };
    try {
      await trigger.runWithoutRow({ console: fakeConsole });
    } catch (e) {
      fakeConsole.error(e.message);
    }
    if (output.length === 0) {
      req.flash(
        "success",
        req.__(
          "Action %s run successfully with no console output",
          trigger.action
        )
      );
      res.redirect(`/actions/`);
    } else {
      res.sendWrap(
        req.__("Test run output"),
        wrap(
          req,
          req.__("Test run"),
          [
            {
              type: "card",
              title: req.__("Test run output"),
              contents: div(
                div({ class: "testrunoutput" }, output),

                a(
                  { href: `/actions`, class: "mt-4 btn btn-primary" },
                  "&laquo;&nbsp;" + req.__("back to actions")
                )
              ),
            },
          ],
          {
            text: req.__("Run %s", trigger.action),
          }
        )
      );
    }
  })
);
