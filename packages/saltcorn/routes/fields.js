const Router = require("express-promise-router");

const db = require("../db");
const types = require("../types");
const { mkTable, mkForm, wrap } = require("./markup.js");
const Field = require("../db/field");
const {
  sqlsanitize,
  fkeyPrefix,
  calc_sql_type,
  attributesToFormFields,
  isAdmin
} = require("./utils.js");

// create a new express-promise-router
// this has the same API as the normal express router except
// it allows you to use async functions as route handlers
const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

router.get("/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  const field = await db.get_field_by_id(id);
  const tables = await db.get_tables();
  const fkey_opts = tables.map(t => fkeyPrefix + t.name);
  res.sendWrap(
    `Edit field`,
    mkForm(
      "/field",
      [
        { name: "id", input_type: "hidden" },
        { name: "table_id", input_type: "hidden" },
        { label: "Name", name: "fname", input_type: "text" },
        { label: "Label", name: "flabel", input_type: "text" },
        {
          label: "Type",
          name: "ftype",
          input_type: "select",
          options: types.names.concat(fkey_opts)
        }
      ],
      field
    )
  );
});

router.get("/new/:table_id", isAdmin, async (req, res) => {
  const { table_id } = req.params;
  const tables = await db.get_tables();
  const fkey_opts = tables.map(t => fkeyPrefix + t.name);
  res.sendWrap(
    `New field`,
    mkForm(
      "/field",
      [
        { name: "table_id", input_type: "hidden" },
        { label: "Name", name: "fname", input_type: "text" },
        { label: "Label", name: "flabel", input_type: "text" },
        {
          label: "Type",
          name: "ftype",
          input_type: "select",
          options: types.names.concat(fkey_opts)
        }
      ],
      { table_id }
    )
  );
});

router.post("/delete/:id", isAdmin, async (req, res) => {
  const { id } = req.params;

  const {
    rows
  } = await db.query("delete FROM fields WHERE id = $1 returning *", [id]);

  const table = await db.get_table_by_id(rows[0].table_id);
  await db.query(
    `alter table ${sqlsanitize(table.name)} drop column ${sqlsanitize(
      rows[0].fname
    )}`
  );

  res.redirect(`/table/${rows[0].table_id}`);
});

router.post("/", isAdmin, async (req, res) => {
  const v = req.body;
  const sql_type = calc_sql_type(v.ftype);
  const fld = new Field(v);
  const attributes = fld.is_fkey ? [] : types.as_dict[v.ftype].attributes;
  if (attributes && typeof v.has_attributes === "undefined") {
    var attrFormFields = attributesToFormFields(fld.type);
    attrFormFields.push({ name: "has_attributes", input_type: "hidden" });
    attrFormFields.push({ name: "fname", input_type: "hidden" });
    attrFormFields.push({ name: "flabel", input_type: "hidden" });
    attrFormFields.push({ name: "ftype", input_type: "hidden" });
    attrFormFields.push({ name: "table_id", input_type: "hidden" });
    const formvals = { has_attributes: "true", ...v };
    res.sendWrap(`New field`, mkForm("/field", attrFormFields, formvals));
  } else {
    if (typeof v.id === "undefined") {
      // insert
      const table = await db.get_table_by_id(v.table_id);
      await db.query(
        `alter table ${sqlsanitize(table.name)} add column ${sqlsanitize(
          v.fname
        )} ${sql_type}`
      );
      if (attributes) {
        var attrs = {};
        attributes.forEach(a => {
          const t = types.as_dict[a.type];
          const aval = t.read(v[a.name]);
          if (typeof aval !== "undefined") attrs[a.name] = aval;
        });
        await db.query(
          "insert into fields(table_id, fname, flabel, ftype, attributes) values($1,$2,$3,$4,$5)",
          [v.table_id, v.fname, v.flabel, v.ftype, attrs]
        );
      } else {
        await db.query(
          "insert into fields(table_id, fname, flabel, ftype) values($1,$2,$3,$4)",
          [v.table_id, v.fname, v.flabel, v.ftype]
        );
      }
    } else {
      // update
      //TODO edit db field
      await db.query(
        "update fields set table_id=$1, fname=$2, flabel=$3, ftype=$4 where id=$5",
        [v.table_id, v.fname, v.flabel, v.ftype, v.id]
      );
    }
    res.redirect(`/table/${v.table_id}`);
  }
});
