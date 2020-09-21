const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const { mkTable, h, link, post_btn } = require("@saltcorn/markup");
const { a } = require("@saltcorn/markup/tags");
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
    const rows = await table.getJoinedRows(joinOpts);
    res.sendWrap(req.__(`%s data table`, table.name), {
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
            mkTable(tfields, rows),
            link(`/edit/${table.name}`, req.__("Add row")),
          ],
        },
      ],
    });
  })
);
