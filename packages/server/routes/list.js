/**
 * List Data from Table (Router)
 * Used in Admin
 * ${base_url}/list
 * Look to server/public/gridedit.js for main logic of grid editor
 * @category server
 * @module routes/list
 * @subcategory routes
 */

import Router from "express-promise-router";

import db from "@saltcorn/data/db";
import { mkTable, link, post_btn } from "@saltcorn/markup";
import {
  script,
  domReady,
  div,
  i,
  text,
  button,
  a,
  input,
  label,
  form,
} from "@saltcorn/markup/tags";
import Table from "@saltcorn/data/models/table";
import { isAdmin, error_catcher, isAdminOrHasConfigMinRole } from "./utils.js";
import moment from "moment";
import { getState } from "@saltcorn/data/db/state";
import { comparingCaseInsensitive } from "@saltcorn/data/utils";

/**
 * @type {object}
 * @const
 * @namespace listRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();

// export our router to be mounted by the parent application
export default router;

/**
 * Show list of table data history (GET handler)
 * @name get/_versions/:name/:id
 * @function
 * @memberof module:routes/list~listRouter
 * @function
 */
router.get(
  "/_versions/:tableName/:id",
  isAdminOrHasConfigMinRole([
    "min_role_edit_tables",
    "min_role_inspect_tables",
  ]),
  error_catcher(async (req, res) => {
    const { tableName, id } = req.params;
    const table = Table.findOne({ name: tableName });

    const fields = table.getFields();
    var tfields = fields.map((f) => ({ label: f.label, key: f.listKey }));
    const pk_name = table.pk_name;
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
          `/list/_restore/${table.name}/${r[pk_name]}/${r._version}`,
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
  "/_restore/:tableName/:id/:_version",
  isAdminOrHasConfigMinRole([
    "min_role_edit_tables",
    "min_role_inspect_tables",
  ]),
  error_catcher(async (req, res) => {
    const { tableName, id, _version } = req.params;
    const table = Table.findOne({ name: tableName });
    await db.withTransaction(async () => {
      await table.restore_row_version(id, _version);
    });
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
    jsgField.editor = "list";

    const values = Array.isArray(field.attributes.options)
      ? field.attributes.options
      : field.attributes.options.split(",").map((o) => o.trim());
    if (!field.required) values.unshift("");

    jsgField.editorParams = { values };
  } else if (t === "Key" || t === "File") {
    jsgField.editor = "list";
    const values = [];
    const valuesObj = {};
    field.options
      .sort(comparingCaseInsensitive("label"))
      .forEach(({ label, value }) => {
        //en space. tabulator workaround
        const l = label === "" ? "\u2002" : label;
        values.push({ label: l, value });
        valuesObj[value] = l;
      });
    jsgField.editorParams = { values };
    jsgField.formatterParams = { values: valuesObj };
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
    jsgField.sorterParams = {
      format: "iso",
    };
    jsgField.editor = "__flatpickerEditor";
    // jsgField.formatter = "datetime";
    // jsgField.formatterParams = {
    //   inputFormat: "iso",
    // };
    jsgField.formatter = "__isoDateTimeFormatter";

    if (field.attributes?.day_only) {
      jsgField.editorParams = { dayOnly: true };
      jsgField.formatter = "__isoDateFormatter";
    }
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
  if (field.primary_key && !field?.attributes?.NonSerial) {
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
  const noId = flds.filter((f) => !f.primary_key);
  const id = flds.find((f) => f.primary_key);
  if (id) return [id, ...noId];
  else return flds;
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
  isAdminOrHasConfigMinRole([
    "min_role_edit_tables",
    "min_role_inspect_tables",
  ]),
  error_catcher(async (req, res) => {
    const { tname } = req.params;
    const table = Table.findOne({ name: tname });
    if (!table) {
      req.flash("error", req.__("Table %s not found", text(tname)));
      res.redirect(`/table`);
      return;
    }
    const fields = table.getFields();
    for (const f of fields) {
      if (f.type === "File") f.attributes = { select_file_where: {} };
      await f.fill_fkey_options();

      if (f.type === "File") {
        //add existing values in folders
        const dvs = await f.distinct_values();
        dvs.forEach((dv) => {
          if (dv?.value?.includes("/")) f.options.push(dv);
        });
      }
    }

    const jsfields = arrangeIdFirst(fields).map((f) =>
      typeToGridType(f.type, f)
    );
    if (table.versioned) {
      jsfields.push({
        field: "_versions",
        title: "Versions",
        formatter: "__versionsFormatter",
        formatterParams: { pk_name: table.pk_name },
      });
    }
    jsfields.push({
      formatter: "__deleteIcon",
      title: "",
      width: 40,
      hozAlign: "center",
      headerSort: false,
      clipboard: false,
      frozen: true,
      cellClick: "__delete_tabulator_row",
    });
    const isDark = getState().getLightDarkMode(req.user) === "dark";
    const pkNm = table.pk_name;
    res.sendWrap(
      {
        title: req.__(`%s data table`, table.name),
        requestFluidLayout: true,
        headers: [
          //jsgrid - grid editor external component
          {
            script: `/static_assets/${db.connectObj.version_tag}/tabulator.min.js`,
          },
          // date flat picker external component
          {
            script: `/static_assets/${db.connectObj.version_tag}/flatpickr.min.js`,
          },
          {
            script: `/static_assets/${db.connectObj.version_tag}/luxon.min.js`,
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
          ...(isDark
            ? [
                {
                  css: `/static_assets/${db.connectObj.version_tag}/flatpickr-dark.css`,
                },
              ]
            : []),
        ],
      },
      {
        above: [
          {
            type: "breadcrumbs",
            crumbs: [
              { text: req.__("Tables"), href: "/table" },
              {
                href: `/table/${table.id || encodeURIComponent(table.name)}`,
                text: table.name,
              },
              { text: req.__("Data") },
            ],
            right: div(
              { class: "d-flex" },
              div(
                {
                  class: "sc-ajax-indicator me-2",
                  style: { display: "none" },
                },
                i({ class: "fas fa-save" })
              ),
              button(
                {
                  class: "btn btn-sm btn-primary me-2",
                  onClick: "add_tabulator_row()",
                },
                i({ class: "fas fa-plus me-1" }),
                "Add row"
              ),
              div(
                { class: "dropdown" },
                button(
                  {
                    class: "btn btn-sm btn-outline-secondary dropdown-toggle",
                    "data-boundary": "viewport",
                    type: "button",
                    id: "btnHideCols",
                    "data-bs-toggle": "dropdown",
                    "aria-haspopup": "true",
                    "aria-expanded": "false",
                  },
                  "Show/hide fields"
                ),
                div(
                  {
                    class: "dropdown-menu dropdown-menu-end",
                    "aria-labelledby": "btnHideCols",
                  },
                  form(
                    { class: "px-2" },
                    a(
                      {
                        onclick: `event.stopPropagation();allnonecols(true,this)`,
                        href: "javascript:;",
                      },
                      "All"
                    ),
                    " | ",
                    a(
                      {
                        onclick: `event.stopPropagation();allnonecols(false,this)`,
                        href: "javascript:;",
                      },
                      "None"
                    ),
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
              window.tabulator_table_primary_key = "${table.pk_name}";
              function tabulator_fill_height() {
                const el = document.getElementById('jsGrid');
                if (!el) return 400;
                return Math.max(200, Math.floor(window.innerHeight - el.getBoundingClientRect().top - 10));
              }
              function tabulator_calc_page_size() {
                const holder = document.querySelector('#jsGrid .tabulator-tableholder');
                if (!holder) return 20;
                const rowH = window._tab_row_height || 35;
                return Math.max(5, Math.floor(holder.clientHeight / rowH));
              }
              const _tab_h = tabulator_fill_height();
              window.tabulator_table = new Tabulator("#jsGrid", {
                  ajaxURL:"/api/${encodeURIComponent(
                    table.name
                  )}?tabulator_pagination_format=true${
                    table.versioned ? "&versioncount=on" : ""
                  }",
                  layout:"fitDataFill",
                  columns,
                  height: _tab_h,
                  pagination:true,
                  paginationMode:"remote",
                  paginationSize: tabulator_calc_page_size(),
                  clipboard:true,
                  /*clipboardCopyRowRange:"range",
                  clipboardPasteParser:"range",
                  clipboardPasteAction:"range",
                  clipboardCopyConfig:{
                      rowHeaders:false, //do not include row headers in clipboard output
                      columnHeaders:false, //do not include column headers in clipboard output
                  },*/
                  clipboardCopyStyled:false,
                  movableColumns: true,
                  ajaxContentType:"json",
                  sortMode:"remote",
                  resizableColumnGuide:true,
                  /*editTriggerEvent:"dblclick",
                  selectableRange:1,
                  selectableRangeRows:true,
                  selectableRangeClearCells:true,*/
                   persistence:{
                      columns: [],
                      sort: true,
                  }, 
                  persistenceID:"scadmintable${encodeURIComponent(
                    table.id || table.name
                  )}",
                  columnDefaults:{
                      resizable:true,
                      maxWidth:500
                  },
                  initialSort:[
                    {column:"${table.pk_name}", dir:"asc"},
                  ],
              });
              window.tabulator_table.on("tableBuilt", function() {
                const ps = tabulator_calc_page_size();
                if (ps !== window.tabulator_table.getPageSize())
                  window.tabulator_table.setPageSize(ps);
              });
              window.tabulator_table.on("dataLoaded", function() {
                if (window._tab_row_height) return;
                const rows = window.tabulator_table.getRows();
                if (!rows.length) return;
                window._tab_row_height = rows[0].getElement().offsetHeight;
                const ps = tabulator_calc_page_size();
                if (ps !== window.tabulator_table.getPageSize())
                  window.tabulator_table.setPageSize(ps);
              });
              let _tab_resize_timer;
              window.addEventListener('resize', function() {
                clearTimeout(_tab_resize_timer);
                _tab_resize_timer = setTimeout(function() {
                  const h = tabulator_fill_height();
                  window.tabulator_table.setHeight(h);
                  const ps = tabulator_calc_page_size();
                  if (ps !== window.tabulator_table.getPageSize())
                    window.tabulator_table.setPageSize(ps);
                }, 150);
              });
              window.allnonecols= (do_show, e) =>{
                columns.forEach(col=>{
                  if(col.frozen && !do_show) return;
                  if (do_show) window.tabulator_table.showColumn(col.field);
                  else window.tabulator_table.hideColumn(col.field);
                  $(e).closest("form").find("input").prop("checked", do_show)
                })            
              }

              window.tabulator_table.on("cellEdited", function(cell){
                const row = cell.getRow().getData()
                const fieldName = cell.getColumn().getField()
                let ident = encodeURIComponent(row.${pkNm}||"");
                if(fieldName === "${pkNm}")
                  ident = "";
                ajax_indicator(true);
                $.ajax({
                  type: "POST",
                  url: "/api/${table.name}/" + ident,
                  data: row,
                  headers: {
                    "CSRF-Token": _sc_globalCsrf,
                  },
                  error: tabulator_error_handler,
                }).done(function (resp) {
                  ajax_indicator(false);
                  //if (item._versions) item._versions = +item._versions + 1;
                  //data.resolve(fixKeys(item));
                  if(resp.success &&(typeof resp.success ==="number" || typeof resp.success ==="string") && !row.${pkNm}) {
                    window.tabulator_table.updateRow(cell.getRow(), {${pkNm}: resp.success});
                  }

                }).fail(function (resp) {
                  ajax_indicate_error(undefined, resp);
                });
              });
              window.tabulator_table_name="${table.name}";`)
              ),
              div({ id: "jsGridNotify" }),

              div({
                id: "jsGrid",
                class:
                  getState().getLightDarkMode(req.user) === "dark"
                    ? "table-dark"
                    : undefined,
              })
            ),
          },
        ],
      }
    );
  })
);

// TODO: increment version count
