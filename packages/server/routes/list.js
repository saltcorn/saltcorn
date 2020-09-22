const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const { mkTable, h, link, post_btn } = require("@saltcorn/markup");
const { a, script, domReady, div } = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const { setTenant, isAdmin, error_catcher } = require("./utils");
const moment = require("moment");

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
const typeToJsGridType = (t) =>
  t.name === "String"
    ? "text"
    : t.name === "Integer"
    ? "number"
    : t.name === "Bool"
    ? "checkbox"
    : "text";
router.get(
  "/:tname",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { tname } = req.params;
    const table = await Table.findOne({ name: tname });

    const fields = await table.getFields();
    var tfields = fields.map((f) =>
      f.type === "File"
        ? { label: f.label, key: `${f.name}__filename` }
        : { label: f.label, key: f.listKey }
    );
    const joinOpts = { orderBy: "id" };
    if (table.versioned) {
      joinOpts.aggregations = {
        _versions: {
          table: table.name + "__history",
          ref: "id",
          field: "id",
          aggregate: "count",
        },
      };
      tfields.push({
        label: req.__("Versions"),
        key: (r) =>
          r._versions > 0
            ? a(
                { href: `/list/_versions/${table.name}/${r.id}` },
                `${r._versions}&nbsp;<i class="fa-sm fas fa-list"></i>`
              )
            : "0",
      });
    }
    tfields.push({
      label: req.__("Edit"),
      key: (r) => link(`/edit/${table.name}/${r.id}`, req.__("Edit")),
    });
    tfields.push({
      label: req.__("Delete"),
      key: (r) =>
        post_btn(
          `/delete/${table.name}/${r.id}`,
          req.__("Delete"),
          req.csrfToken()
        ),
    });
    //const rows = await table.getJoinedRows(joinOpts);
    const jsfields = fields.map((f) => ({
      name: f.name,
      type: typeToJsGridType(f.type),
    }));
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
            type: "card",
            title: req.__(`%s data table`, table.name),
            contents: [
              script(`var edit_fields=${JSON.stringify(jsfields)};`),
              script(
                domReady(`$("#jsGrid").jsGrid({
                height: "70vh",
                width: "100%",
                noDataContent: "Not founde",
                sorting: true,
                paging: true,
                autoload: true,
                         
                controller: jsgrid_controller("${table.name}"),
         
                fields: edit_fields
            });
         `)
              ),
              div({ id: "jsGrid" }),
              link(`/edit/${table.name}`, req.__("Add row")),
            ],
          },
        ],
      }
    );
  })
);
