const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const { mkTable, h, link, post_btn } = require("@saltcorn/markup");
const { a, script, domReady, div, text } = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const { setTenant, isAdmin, error_catcher } = require("./utils");
const moment = require("moment");
const { readState } = require("@saltcorn/data/plugin-helper");

const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

router.get(
  "/_versions/:name/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name, id } = req.params;
    const table = await Table.findOne({ name });

    const fields = await table.getFields();
    var tfields = fields.map((f) => ({ label: f.label, key: f.listKey }));

    tfields.push({
      label: req.__("Version"),
      key: (r) => r._version,
    });
    tfields.push({
      label: req.__("Saved"),
      key: (r) => moment(r._time).fromNow(),
    });
    tfields.push({
      label: req.__("By user ID"),
      key: (r) => r._userid,
    });
    tfields.push({
      label: req.__("Restore"),
      key: (r) =>
        post_btn(
          `/list/_restore/${table.name}/${r.id}/${r._version}`,
          req.__("Restore"),
          req.csrfToken()
        ),
    });
    const rows = await table.get_history(+id);

    res.sendWrap(
      req.__(`%s History`, table.name),
      mkTable(tfields, rows),
      link(`/list/${table.name}`, "&laquo;" + req.__("back to table list"))
    );
  })
);

router.post(
  "/_restore/:name/:id/:_version",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name, id, _version } = req.params;
    const table = await Table.findOne({ name });

    const fields = await table.getFields();
    const row = await db.selectOne(`${db.sqlsanitize(table.name)}__history`, {
      id,
      _version,
    });
    var r = {};
    fields.forEach((f) => (r[f.name] = row[f.name]));
    await table.updateRow(r, +id);
    req.flash("success", req.__("Version %s restored", _version));
    res.redirect(`/list/_versions/${table.name}/${id}`);
  })
);
const typeToJsGridType = (t, field) => {
  var jsgField = { name: field.name, title: field.label };
  if (t.name === "String" && field.attributes && field.attributes.options) {
    jsgField.type = "select";
    jsgField.items = field.attributes.options
      .split(",")
      .map((o) => ({ value: o.trim(), label: o.trim() }));
    jsgField.valueField = "value";
    jsgField.textField = "label";
    if (!field.required) jsgField.items.unshift("");
  } else if (t === "Key" || t === "File") {
    jsgField.type = "select";
    //console.log(field.options);
    jsgField.items = field.options;
    jsgField.valueField = "value";
    jsgField.textField = "label";
  } else
    jsgField.type =
      t.name === "String"
        ? "text"
        : t.name === "Integer"
        ? "number"
        : t.name === "Float"
        ? "decimal"
        : t.name === "Bool"
        ? "checkbox"
        : t.name === "Color"
        ? "color"
        : t.name === "Date"
        ? "date"
        : "text";
  if (field.calculated) {
    jsgField.editing = false;
    jsgField.inserting = false;
  }
  return jsgField;
};

const versionsField = (tname) => `
var VersionsField = function(config) {
  jsGrid.Field.call(this, config);
};
VersionsField.prototype = new jsGrid.Field({
  align: "right",
  itemTemplate: function(value, item) {
      if(value) {
        //return +value+1;
        return '<a href="/list/_versions/${tname}/'+item.id+'">'+
        value+'&nbsp;<i class="fa-sm fas fa-list"></i></a>';      
      } else return ''
  },

});
jsGrid.fields.versions = VersionsField;
`;

router.get(
  "/:tname",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { tname } = req.params;
    const table = await Table.findOne({ name: tname });
    if (!table) {
      req.flash("error", req.__("Table %s not found", text(tname)));
      res.redirect(`/table`);
      return;
    }
    const fields = await table.getFields();
    for (const f of fields) {
      if (f.type === "File") f.attributes = { select_file_where: {} };
      await f.fill_fkey_options();
    }

    //console.log(fields);
    const keyfields = fields
      .filter((f) => f.type === "Key" || f.type === "File")
      .map((f) => f.name);
    const jsfields = fields.map((f) => typeToJsGridType(f.type, f));
    if (table.versioned) {
      jsfields.push({ name: "_versions", title: "Versions", type: "versions" });
    }
    jsfields.push({ type: "control" });
    jsfields.unshift({
      name: "id",
      title: "id",
      type: "number",
      editing: false,
      inserting: false,
    });
    res.sendWrap(
      {
        title: req.__(`%s data table`, table.name),
        headers: [
          {
            script:
              "https://cdnjs.cloudflare.com/ajax/libs/jsgrid/1.5.3/jsgrid.min.js",
            integrity:
              "sha512-blBYtuTn9yEyWYuKLh8Faml5tT/5YPG0ir9XEABu5YCj7VGr2nb21WPFT9pnP4fcC3y0sSxJR1JqFTfTALGuPQ==",
          },
          {
            script:
              "https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.6/flatpickr.min.js",
            integrity:
              "sha512-Nc36QpQAS2BOjt0g/CqfIi54O6+UWTI3fmqJsnXoU6rNYRq8vIQQkZmkrRnnk4xKgMC3ESWp69ilLpDm6Zu8wQ==",
          },
          {
            script: "/gridedit.js",
          },
          {
            css:
              "https://cdnjs.cloudflare.com/ajax/libs/jsgrid/1.5.3/jsgrid.min.css",
            integrity:
              "sha512-3Epqkjaaaxqq/lt5RLJsTzP6cCIFyipVRcY4BcPfjOiGM1ZyFCv4HHeWS7eCPVaAigY3Ha3rhRgOsWaWIClqQQ==",
          },
          {
            css:
              "https://cdnjs.cloudflare.com/ajax/libs/jsgrid/1.5.3/jsgrid-theme.min.css",
            integrity:
              "sha512-jx8R09cplZpW0xiMuNFEyJYiGXJM85GUL+ax5G3NlZT3w6qE7QgxR4/KE1YXhKxijdVTDNcQ7y6AJCtSpRnpGg==",
          },
          {
            css:
              "https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.6/flatpickr.min.css",
            integrity:
              "sha512-OtwMKauYE8gmoXusoKzA/wzQoh7WThXJcJVkA29fHP58hBF7osfY0WLCIZbwkeL9OgRCxtAfy17Pn3mndQ4PZQ==",
          },
        ],
      },
      {
        above: [
          {
            type: "breadcrumbs",
            crumbs: [
              { text: req.__("Tables"), href: "/table" },
              { href: `/table/${table.id}`, text: table.name },
              { text: req.__("Data") },
            ],
          },
          {
            type: "blank",
            contents: div(
              script(`var edit_fields=${JSON.stringify(jsfields)};`),
              script(domReady(versionsField(table.name))),
              script(
                domReady(`$("#jsGrid").jsGrid({
                width: "100%",
                sorting: true,
                paging: true,
                autoload: true,
                inserting: true,
                editing: true,
                         
                controller: 
                  jsgrid_controller("${table.name}", ${JSON.stringify(
                  table.versioned
                )}, ${JSON.stringify(keyfields)}),
         
                fields: edit_fields
            });
         `)
              ),
              div({ id: "jsGridNotify" }),
              div({ id: "jsGrid" })
            ),
          },
        ],
      }
    );
  })
);
