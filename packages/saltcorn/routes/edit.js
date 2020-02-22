const Router = require("express-promise-router");

const db = require("../db");
const { mkTable, mkForm, wrap, h, link, post_btn } = require("./markup.js");
const { sqlsanitize,type_to_input } = require("./utils.js");

const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

//create -- new
router.get("/:tname", async (req, res) => {
  const { tname } = req.params;
  const table = await db.get_table_by_name(tname);

  const fields = await db.get_fields_by_table_id(table.id);
  const tfields=fields.map((f)=>({
    label: f.flabel, 
    name: f.fname,
    input_type: type_to_input(f.ftype)
  }))
  res.send(
    wrap(
      `${table.name} create new`,
      h(1, 'New '+table.name),
      mkForm(
        `/edit/${tname}`,
        tfields
        
      )
    )
  );
});

router.post("/:tname", async (req, res) => {
  const { tname } = req.params;
  const table = await db.get_table_by_name(tname);

  const fields = await db.get_fields_by_table_id(table.id);
  const v = req.body;
  if (typeof v.id === "undefined") {
    const fnameList=fields.map((f=>sqlsanitize(f.fname))).join()
    const valList=fields.map(f=>v[f.fname])
    const valPosList=fields.map((f,ix)=>'$'+(ix+1)).join()
    await db.query(
      `insert into ${sqlsanitize(table.name)}(${fnameList}) values(${valPosList})`,
      valList
    );
  }
  res.redirect(`/list/${table.name}`);
})
