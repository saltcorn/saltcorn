const Router = require("express-promise-router");
const db = require("saltcorn-data/db");
const { isAdmin } = require("./utils.js");
const { mkTable, renderForm, link, post_btn } = require("saltcorn-markup");
const State = require("saltcorn-data/db/state");
const Form = require("saltcorn-data/models/form");
const Field = require("saltcorn-data/models/field");

const router = new Router();
module.exports = router;

const pluginForm = plugin => {
  const form = new Form({
    action: "/plugins",
    fields: [
      new Field({ label: "Name", name: "name", input_type: "text" }),
      new Field({
        label: "Source",
        name: "source",
        type: State.types.String,
        attributes: { options: "npm,local,git" }
      }),
      new Field({ label: "Location", name: "location", input_type: "text" })
    ],
    submitLabel: plugin ? "Save" : "Create"
  });
  if (plugin) {
    form.hidden("id");
    form.values = plugin;
  }
  return form;
};
router.get("/", isAdmin, async (req, res) => {
  const rows = await db.select("plugins");
  res.sendWrap(
    "Plugins",
    mkTable(
      [
        { label: "Name", key: "name" },
        { label: "Source", key: "source" },
        { label: "Location", key: "location" },
        { label: "View", key: r => link(`/plugins/${r.id}`, "Edit") },
        {
          label: "Delete",
          key: r => post_btn(`/plugins/delete/${r.id}`, "Remove")
        }
      ],
      rows
    ),
    link(`/plugins/new`, "Add plugin")
  );
});

router.get("/new/", isAdmin, async (req, res) => {
  res.sendWrap(`New Plugin`, renderForm(pluginForm()));
});

router.get("/:id/", isAdmin, async (req, res) => {
  const { id } = req.params;
  const plugin = await db.selectOne("plugins", { id });

  res.sendWrap(`Edit Plugin`, renderForm(pluginForm(plugin)));
});

router.post("/", isAdmin, async (req, res) => {
  const { id, ...v } = req.body;
  if (typeof id === "undefined") {
    // insert
    await db.insert("plugins", v);
    req.flash("success", "Plugin created");
  } else {
    await db.update("plugins", v, id);
  }
  res.redirect(`/plugins`);
});

router.post("/delete/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  const u = await db.deleteWhere("plugins", { id });
  req.flash("success", "Plugin removed");

  res.redirect(`/plugins`);
});
