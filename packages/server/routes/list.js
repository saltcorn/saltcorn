/**
 * List Data from Table (Router)
 * Used in Admin
 * ${base_url}/list
 * Look to server/public/gridedit.js for main logic of grid editor
 * @category server
 * @module routes/list
 * @subcategory routes
 */

const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const { mkTable, h, link, post_btn } = require("@saltcorn/markup");
const {
  a,
  script,
  domReady,
  div,
  i,
  text,
  button,
  input,
  label,
  form,
} = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const { isAdmin, error_catcher } = require("./utils");
const moment = require("moment");
const { readState } = require("@saltcorn/data/plugin-helper");

/**
 * @type {object}
 * @const
 * @namespace listRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

/**
 * Show list of table data history (GET handler)
 * @name get/_versions/:name/:id
 * @function
 * @memberof module:routes/list~listRouter
 * @function
 */
router.get(
  "/_versions/:name/:id",
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

/**
 * Restore version of data in table (POST handler)
 * @name post/_restore/:name/:id/:_version
 * @function
 * @memberof module:routes/list~listRouter
 * @function
 */
router.post(
  "/_restore/:name/:id/:_version",
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
/**
 * Saltcorn Type to JSGrid Type
 * @param t
 * @param field
 * @returns {{name, title}}
 */
const typeToGridType = (t, field) => {
  const jsgField = { field: field.name, title: field.label, editor: true };
  if (t.name === "String" && field.attributes && field.attributes.options) {
    jsgField.editor = "select";

    const values = field.attributes.options.split(",").map((o) => o.trim());
    if (!field.required) values.unshift("");

    jsgField.editorParams = { values };
  } else if (t === "Key" || t === "File") {
    jsgField.editor = "select";
    const values = {};

    field.options.forEach(({ label, value }) => (values[value] = label));
    jsgField.editorParams = { values };
    jsgField.formatterParams = { values };
    jsgField.formatter = "__lookupIntToString";
  } else if (t.name === "Float" || t.name === "Integer") {
    jsgField.editor = "number";
    jsgField.sorter = "number";
    jsgField.hozAlign = "right";
    jsgField.headerHozAlign = "right";
    jsgField.editorParams = {
      step: t.name === "Integer" ? 1 : undefined,
      min:
        typeof field.attributes.min !== "undefined"
          ? field.attributes.min
          : undefined,
      max:
        typeof field.attributes.max !== "undefined"
          ? field.attributes.max
          : undefined,
    };
  } else if (t.name === "Bool") {
    jsgField.editor = "tickCross";
    jsgField.formatter = "tickCross";
    jsgField.hozAlign = "center";
    jsgField.vertAlign = "center";
    jsgField.editorParams = field.required ? {} : { tristate: true };
    jsgField.formatterParams = field.required ? {} : { allowEmpty: true };
  } else if (t.name === "Date") {
    jsgField.sorter = "date";
    jsgField.editor = "__flatpickerEditor";
    jsgField.formatter = "__isoDateTimeFormatter";
  } else if (t.name === "Color") {
    jsgField.editor = "__colorEditor";
    jsgField.formatter = "__colorFormatter";
    jsgField.hozAlign = "center";
    jsgField.vertAlign = "center";
  } else if (t.name === "JSON") {
    jsgField.formatter = "__jsonFormatter";
    jsgField.editor = "__jsonEditor";
  }

  if (field.calculated) {
    jsgField.editor = false;
  }
  if (field.primary_key) {
    jsgField.editor = false;
  }
  return jsgField;
};

/**
 * Version Field
 * @param {string} tname
 * @returns {string}
 */
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
// end of versionsField

const arrangeIdFirst = (flds) => {
  const noId = flds.filter((f) => f.name !== "id");
  const id = flds.find((f) => f.name === "id");
  return [id, ...noId];
};

/**
 * Table Data List Viewer (GET handler))
 * @name get/:tname
 * @function
 * @memberof module:routes/list~listRouter
 * @function
 */
router.get(
  "/:tname",
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
      .map((f) => ({ name: f.name, type: f.reftype }));
    const jsfields = arrangeIdFirst(fields).map((f) =>
      typeToGridType(f.type, f)
    );
    if (table.versioned) {
      jsfields.push({
        field: "_versions",
        title: "Versions",
        formatter: "__versionsFormatter",
      });
    }
    jsfields.push({
      formatter: "buttonCross",
      title: i({ class: "far fa-trash-alt" }),
      width: 40,
      hozAlign: "center",
      headerSort: false,
      cellClick: "__delete_tabulator_row",
    });
    res.sendWrap(
      {
        title: req.__(`%s data table`, table.name),
        headers: [
          //jsgrid - grid editor external component
          {
            script: `/static_assets/${db.connectObj.version_tag}/tabulator.min.js`,
          },
          // date flat picker external component
          {
            script: `/static_assets/${db.connectObj.version_tag}/flatpickr.min.js`,
          },
          // main logic for grid editor is here
          {
            script: `/static_assets/${db.connectObj.version_tag}/gridedit.js`,
          },
          //css for jsgrid - grid editor external component
          {
            css: `/static_assets/${db.connectObj.version_tag}/tabulator_bootstrap4.min.css`,
          },

          // css for date flat picker external component
          {
            css: `/static_assets/${db.connectObj.version_tag}/flatpickr.min.css`,
          },
        ],
      },
      {
        above: [
          {
            type: "breadcrumbs",
            crumbs: [
              { text: req.__("Tables"), href: "/table" },
              { href: `/table/${table.id || table.name}`, text: table.name },
              { text: req.__("Data") },
            ],
            right:
              button(
                {
                  class: "btn btn-sm btn-primary mr-2",
                  onClick: "add_tabulator_row()",
                },
                i({ class: "fas fa-plus mr-1" }),
                "Add row"
              ) +
              div(
                { class: "dropdown d-inline" },
                button(
                  {
                    class: "btn btn-sm btn-outline-secondary dropdown-toggle",
                    "data-boundary": "viewport",
                    type: "button",
                    id: "btnHideCols",
                    "data-toggle": "dropdown",
                    "aria-haspopup": "true",
                    "aria-expanded": "false",
                  },
                  "Show/hide fields"
                ),
                div(
                  {
                    class: "dropdown-menu",
                    "aria-labelledby": "btnHideCols",
                  },
                  form(
                    { class: "px-2" },
                    fields.map((f) =>
                      div(
                        { class: "form-check" },
                        input({
                          type: "checkbox",
                          onChange: `showHideCol('${f.name}', this)`,
                          class: "form-check-input",
                          checked: true,
                        }),
                        label(f.name)
                      )
                    )
                  )
                )
              ),
          },
          {
            type: "blank",
            contents: div(
              //script(`var edit_fields=${JSON.stringify(jsfields)};`),
              //script(domReady(versionsField(table.name))),
              script(
                domReady(`
              const columns=${JSON.stringify(jsfields)};          
              columns.forEach(col=>{
                Object.entries(col).forEach(([k,v])=>{
                  if(typeof v === "string" && v.startsWith("__"))
                    col[k] = window[v.substring(2)];
                })
              })   
              window.tabulator_table = new Tabulator("#jsGrid", {
                  ajaxURL:"/api/${table.name}${
                  table.versioned ? "?versioncount=on" : ""
                }",                   
                  layout:"fitColumns", 
                  columns,
                  height:"100%",
                  pagination:true,
                  paginationSize:20,
                  initialSort:[
                    {column:"id", dir:"asc"},
                  ],
                  ajaxResponse:function(url, params, response){                    
            
                    return response.success; //return the tableData property of a response json object
                  },
              });
              window.tabulator_table.on("cellEdited", function(cell){
                const row = cell.getRow().getData()
                $.ajax({
                  type: "POST",
                  url: "/api/${table.name}/" + (row.id||""),
                  data: row,
                  headers: {
                    "CSRF-Token": _sc_globalCsrf,
                  },
                  error: tabulator_error_handler,
                }).done(function (resp) {
                  //if (item._versions) item._versions = +item._versions + 1;
                  //data.resolve(fixKeys(item));
                  if(resp.success &&typeof resp.success ==="number" && !row.id) {
                    window.tabulator_table.updateRow(cell.getRow(), {id: resp.success});
                  }

                });
              });
              window.tabulator_table_name="${table.name}";`)
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

// TODO: increment version count
