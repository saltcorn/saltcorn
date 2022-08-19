const {
  a,
  div,
  text,
  button,
  i,
  form,
  select,
  option,
  label,
} = require("@saltcorn/markup/tags");

const Tag = require("@saltcorn/data/models/tag");
const TagEntry = require("@saltcorn/data/models/tag_entry");
const Router = require("express-promise-router");

const { isAdmin, error_catcher, csrfField } = require("./utils");

const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const Page = require("@saltcorn/data/models/page");
const Trigger = require("@saltcorn/data/models/trigger");

const router = new Router();
module.exports = router;

const buildFields = (entryType, formOptions, req) => {
  return Object.entries(formOptions).map(([type, list]) => {
    return div(
      { class: "form-group row" },
      div({ class: "col-sm-2" }, label("type")),
      div(
        { class: "col-sm-10" },
        select(
          { name: "ids", class: "form-control form-select", multiple: true },
          list.map((entry) => {
            return option({ value: entry.id, label: entry.name });
          })
        )
      ),
      div(
        { class: "col-sm-12" },
        button({ type: "submit", class: "btn btn-primary" }, req.__("Save"))
      )
    );
  });
};

const buildForm = (entryType, tag_id, formOptions, req) => {
  return form(
    { action: `/tag-entries/add/${entryType}/${tag_id}`, method: "post" },
    csrfField(req),
    buildFields(entryType, formOptions, req)
  );
};

const formOptions = async (type, tag_id) => {
  const tag = await Tag.findOne({ id: tag_id });
  switch (type) {
    case "tables": {
      const ids = await tag.getTableIds();
      return {
        tables: (await Table.find()).filter(
          (value) => ids.indexOf(value.id) === -1
        ),
      };
    }
    case "views": {
      const ids = await tag.getViewIds();
      return {
        views: (await View.find()).filter(
          (value) => ids.indexOf(value.id) === -1
        ),
      };
    }
    case "pages": {
      const ids = await tag.getPageIds();
      return {
        pages: (await Page.find()).filter(
          (value) => ids.indexOf(value.id) === -1
        ),
      };
    }
    case "trigger": {
      const ids = await tag.getTriggerIds();
      return {
        trigger: (await Trigger.find()).filter(
          (value) => ids.indexOf(value.id) === -1
        ),
      };
    }
  }
};

router.get(
  "/add/:entry_type/:tag_id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { entry_type, tag_id } = req.params;
    res.sendWrap(req.__("Add %s to tag"), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: `Tag entry` }],
        },
        {
          type: "card",
          title: `Add entries to tag`,
          contents: buildForm(
            entry_type,
            tag_id,
            await formOptions(entry_type, tag_id),
            req
          ),
        },
      ],
    });
  })
);

const idField = (entryType) => {
  switch (entryType) {
    case "tables": {
      return "table_id";
    }
    case "views": {
      return "view_id";
    }
    case "pages": {
      return "page_id";
    }
    case "trigger": {
      return "trigger_id";
    }
  }
  return null;
};

router.post(
  "/add/:entry_type/:tag_id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { entry_type, tag_id } = req.params;
    const { ids } = req.body;
    if (!ids) {
      req.flash("error", req.__("Please select at least on item"));
      return res.redirect(`/tag-entries/add/${entry_type}/${tag_id}`);
    }
    const fieldName = idField(entry_type);
    const tag = await Tag.findOne({ id: tag_id });
    for (const id of ids) {
      await tag.addEntry({ [fieldName]: id });
    }
    res.redirect(`/tag/${tag_id}?show_list=${entry_type}`);
  })
);

router.post(
  "/remove/:entry_type/:entry_id/:tag_id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { tag_id, entry_type, entry_id } = req.params;
    const fieldName = idField(entry_type);
    const entry = await TagEntry.findOne({ tag_id, [fieldName]: entry_id });
    entry[fieldName] = undefined;
    if (entry.isEmpty()) {
      await entry.delete();
    } else {
      await TagEntry.update(entry.id, { [fieldName]: null });
    }
    res.redirect(`/tag/${tag_id}?show_list=${entry_type}`);
  })
);
