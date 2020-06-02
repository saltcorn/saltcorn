const Router = require("express-promise-router");
const File = require("@saltcorn/data/models/file");

const {
  mkTable,
  renderForm,
  link,
  post_btn,
  post_delete_btn
} = require("@saltcorn/markup");
const { setTenant, isAdmin } = require("./utils.js");
const {
  span,
  h5,
  h4,
  nbsp,
  p,
  a,
  div,
  form,
  input,
  button
} = require("@saltcorn/markup/tags");

const router = new Router();
module.exports = router;

router.get("/", setTenant, isAdmin, async (req, res) => {
  const rows = await File.find({}, { orderBy: "filename" });

  res.sendWrap(
    "Files",
    mkTable(
      [
        { label: "Filename", key: "filename" },
        {
          label: "Delete",
          key: r => post_delete_btn(`/files/delete/${r.id}`)
        }
      ],
      rows
    ),
    form(
      { action: "/files/upload", method: "post" },
      input({ name: "file", type: "file" }),
      button({ type: "submit", class: "btn btn-primary" }, "Upload file")
    )
  );
});

router.post("/upload", setTenant, isAdmin, async (req, res) => {
  console.log(req.files); // the uploaded file object
  res.redirect("/files");
});
