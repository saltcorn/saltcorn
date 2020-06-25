const Router = require("express-promise-router");
const File = require("@saltcorn/data/models/file");
const User = require("@saltcorn/data/models/user");

const {
  mkTable,
  renderForm,
  link,
  post_btn,
  post_delete_btn
} = require("@saltcorn/markup");
const { setTenant, isAdmin, error_catcher } = require("./utils.js");
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
  select,
  button,
  option,
  text,
  label
} = require("@saltcorn/markup/tags");
const { csrfField } = require("./utils");

const router = new Router();
module.exports = router;

const editRoleForm = (file, roles, req) =>
  form(
    {
      action: `/files/setrole/${file.id}`,
      method: "post"
    },
    csrfField(req),
    select(
      { name: "role", onchange: "form.submit()" },
      roles.map(role =>
        option(
          {
            value: role.id,
            ...(file.min_role_read === role.id && { selected: true })
          },
          text(role.role)
        )
      )
    )
  );

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const rows = await File.find({}, { orderBy: "filename" });
    const roles = await User.get_roles();
    res.sendWrap(
      "Files",
      mkTable(
        [
          { label: "Filename", key: "filename" },
          { label: "Size (KiB)", key: "size_kb" },
          { label: "Media type", key: r => r.mimetype },
          { label: "Role to access", key: r => editRoleForm(r, roles, req) },
          {
            label: "Link",
            key: r => link(`/files/serve/${r.id}`, "Link")
          },
          {
            label: "Download",
            key: r => link(`/files/download/${r.id}`, "Download")
          },
          {
            label: "Delete",
            key: r => post_delete_btn(`/files/delete/${r.id}`, req.csrfToken())
          }
        ],
        rows
      ),
      form(
        {
          action: "/files/upload",
          method: "post",
          encType: "multipart/form-data"
        },
        csrfField(req),
        label("Upload file "),
        input({
          name: "file",
          class: "form-control-file",
          type: "file",
          onchange: "form.submit()"
        })
      )
    );
  })
);

router.get(
  "/download/:id",
  setTenant,
  error_catcher(async (req, res) => {
    const role = req.isAuthenticated() ? req.user.role_id : 10;
    const user_id = req.user && req.user.id;
    const { id } = req.params;
    const file = await File.findOne({ id });
    if (role <= file.min_role_read || (user_id && user_id === file.user_id)) {
      res.type(file.mimetype);
      res.download(file.location, file.filename);
    } else {
      req.flash("warning", "Not authorized");
      res.redirect("/");
    }
  })
);

router.get(
  "/serve/:id",
  setTenant,
  error_catcher(async (req, res) => {
    const role = req.isAuthenticated() ? req.user.role_id : 10;
    const user_id = req.user && req.user.id;
    const { id } = req.params;
    const file = await File.findOne({ id });
    if (role <= file.min_role_read || (user_id && user_id === file.user_id)) {
      res.type(file.mimetype);
      const cacheability = file.min_role_read === 10 ? "public" : "private";
      res.set("Cache-Control", `${cacheability}, max-age=3600`);
      res.sendFile(file.location);
    } else {
      req.flash("warning", "Not authorized");
      res.redirect("/");
    }
  })
);

router.post(
  "/setrole/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const role = req.body.role;
    await File.update(+id, { min_role_read: role });
    res.redirect("/files");
  })
);

router.post(
  "/upload",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    if (!req.files && !req.files.file) {
      req.flash("warning", "No file found");
    } else {
      const f = await File.from_req_files(req.files.file, req.user.id);
      req.flash("success", `File ${text(f.filename)} uploaded`);
    }

    res.redirect("/files");
  })
);
