/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/multi_file_upload
 * @subcategory base-plugin
 */

const Table = require("../../models/table");
const Form = require("../../models/form");
const Workflow = require("../../models/workflow");
const File = require("../../models/file");
const User = require("../../models/user");
const { InvalidConfiguration } = require("../../utils");
const {
  div,
  p,
  span,
  a,
  i,
  button,
  text,
  text_attr,
  strong,
} = require("@saltcorn/markup/tags");
const { basename } = require("path");
const db = require("../../db");

const VIEW_NAME = "Multi file upload";

const isFileField = (field) =>
  field &&
  (field.type === "File" ||
    field.type?.name === "File" ||
    field.type === "File[]" ||
    field.type?.name === "File[]");

const parseFieldRef = (value = "") => {
  if (!value.includes(".")) return { table: null, field: value };
  const [table, field] = value.split(".");
  return { table, field };
};

const optionWithName = (label, name) => ({ label, name, value: name });

const buildChildOptions = async (table) => {
  const { child_relations } = await table.get_child_relations(false);
  const relationOptions = child_relations.map(({ key_field, table: ctable }) =>
    optionWithName(
      `${ctable.name} ▸ ${key_field.label || key_field.name}`,
      `${ctable.name}.${key_field.name}`
    )
  );
  const childTables = {};
  for (const rel of child_relations) {
    if (!childTables[rel.table.name]) childTables[rel.table.name] = rel.table;
  }
  const fileFieldOptions = [];
  for (const childName of Object.keys(childTables)) {
    const childTable = childTables[childName];
    await childTable.getFields();
    childTable.fields.forEach((f) => {
      const label = `${childName}.${f.label || f.name}`;
      const option = optionWithName(label, `${childName}.${f.name}`);
      if (isFileField(f)) {
        fileFieldOptions.push(option);
      }
    });
  }
  const unique = (list) =>
    list.filter(
      (opt, ix, arr) => arr.findIndex((o) => o.value === opt.value) === ix
    );
  return {
    relationOptions,
    fileFieldOptions: unique(fileFieldOptions),
  };
};

const buildDefaultCopy = (req) => ({
  dropLabel: req.__("Drop files here or click to browse"),
  emptyText: req.__("No files uploaded yet"),
  disabledText: req.__("Save this record before uploading files."),
  uploadLabel: req.__("Select files"),
  uploadingText: req.__("Uploading..."),
  successText: req.__("Files uploaded"),
  errorText: req.__("Could not upload files"),
  deleteConfirm: req.__("Remove this file?"),
});

const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      {
        name: req.__("Upload settings"),
        form: async (context) => {
          const table = Table.findOne({ id: context.table_id });
          await table.getFields();
          const { relationOptions, fileFieldOptions } =
            await buildChildOptions(table);
          const roles = await User.get_roles();
          if (!relationOptions.length) {
            return new Form({
              fields: [
                {
                  input_type: "section_header",
                  label: req.__(
                    "No child relations available. Add a Key field in another table that references %s first.",
                    table.name
                  ),
                },
              ],
            });
          }
          const modeOptions = [
            optionWithName(req.__("Multiple file input"), "input"),
            optionWithName(req.__("Drag & drop"), "dropzone"),
            optionWithName(req.__("FilePond"), "filepond"),
          ];
          return new Form({
            fields: [
              {
                name: "child_relation",
                label: req.__("Child relation"),
                type: "String",
                required: true,
                attributes: { options: relationOptions },
                sublabel: req.__(
                  "Foreign key field on the child table pointing back to %s",
                  table.name
                ),
              },
              {
                name: "file_field",
                label: req.__("File field"),
                type: "String",
                required: true,
                attributes: { options: fileFieldOptions },
                sublabel: req.__(
                  "Field on the child table that stores the uploaded file"
                ),
              },
              {
                name: "target_folder",
                label: req.__("Upload folder"),
                type: "String",
                sublabel: req.__(
                  "Optional sub-folder inside the Files area (defaults to root)"
                ),
              },
              {
                name: "file_min_role",
                label: req.__("Minimum role to read files"),
                type: "Integer",
                input_type: "select",
                options: roles.map((r) => ({ value: r.id, label: r.role })),
                default: 1,
              },
              {
                name: "ui_mode",
                label: req.__("Upload UI"),
                type: "String",
                required: true,
                default: "input",
                attributes: { options: modeOptions },
              },
              {
                name: "show_existing",
                label: req.__("Show existing files"),
                type: "Bool",
                default: true,
              },
              {
                name: "allow_delete",
                label: req.__("Allow deleting files"),
                type: "Bool",
                default: true,
                showIf: { show_existing: true },
              },
              {
                name: "delete_from_store",
                label: req.__("Remove stored file when deleting"),
                type: "Bool",
                showIf: { allow_delete: true },
                sublabel: req.__(
                  "If enabled, deleting a child row also deletes the uploaded file from the file store."
                ),
              },
            ],
          });
        },
      },
    ],
  });

const resolveConfig = async (table_id, configuration) => {
  const parentTable = Table.findOne({ id: table_id });
  if (!configuration.child_relation)
    throw new InvalidConfiguration("Missing child relation");
  const { table: childTableName, field: fkFieldName } = parseFieldRef(
    configuration.child_relation
  );
  const childTable = Table.findOne({ name: childTableName });
  if (!childTable)
    throw new InvalidConfiguration(`Cannot find child table ${childTableName}`);
  await childTable.getFields();
  const fkField = childTable.getField(fkFieldName);
  if (!fkField)
    throw new InvalidConfiguration(
      `Cannot find foreign key field ${fkFieldName} on ${childTable.name}`
    );
  const { field: fileFieldName } = parseFieldRef(configuration.file_field);
  const fileField = childTable.getField(fileFieldName);
  if (!isFileField(fileField))
    throw new InvalidConfiguration(
      `Field ${fileFieldName} on ${childTable.name} must be a File field`
    );
  return {
    parentTable,
    parentPk: parentTable.pk_name,
    childTable,
    childPk: childTable.pk_name,
    fkField,
    fileField,
  };
};

const buildListHtml = (rows, childTable, fileField, cfg, req, copy) => {
  if (!cfg.show_existing) return "";
  if (!rows || rows.length === 0)
    return div(
      { class: "sc-mfu-empty text-muted", "data-mfu-empty": "true" },
      copy.emptyText
    );
  const allowDelete = cfg.allow_delete !== false;
  return rows
    .map((row) => {
      const filepath = row[fileField.name];
      const servePath = File.pathToServeUrl(filepath || "");
      const fileName = filepath ? basename(filepath) : req.__("File");
      const meta = row.updated_at || row.created_at;
      return div(
        {
          class: "sc-mfu-row d-flex align-items-center justify-content-between",
          "data-mfu-row": row[childTable.pk_name],
        },
        span(
          { class: "me-2" },
          a(
            { href: servePath, target: "_blank", class: "sc-mfu-link" },
            fileName
          ),
          meta
            ? span(
                { class: "text-muted small ms-2" },
                req.__("Updated %s", new Date(meta).toLocaleString())
              )
            : ""
        ),
        allowDelete
          ? button(
              {
                type: "button",
                class: "btn btn-link text-danger p-0 sc-mfu-delete",
                "data-mfu-delete": row[childTable.pk_name],
                title: req.__("Delete"),
              },
              i({ class: "fas fa-trash" })
            )
          : ""
      );
    })
    .join("");
};

const buildClientConfig = (viewname, parentId, configuration, copy) => ({
  viewname,
  rowId: parentId || null,
  mode: configuration.ui_mode || "input",
  allowDelete:
    configuration.allow_delete !== false &&
    configuration.show_existing !== false,
  showList: configuration.show_existing !== false,
  dropLabel: copy.dropLabel,
  emptyText: copy.emptyText,
  disabledText: copy.disabledText,
  uploadLabel: copy.uploadLabel,
  uploadingText: copy.uploadingText,
  successText: copy.successText,
  errorText: copy.errorText,
  deleteConfirm: copy.deleteConfirm,
});

const renderControls = (configuration, req, copy) => {
  const showDrop = configuration.ui_mode === "dropzone";
  return (
    div(
      { class: "mb-2" },
      span({ class: "form-label fw-semibold" }, req.__("Files")),
      div(
        { class: ["sc-mfu-input", showDrop && "d-none"] },
        `<input type="file" class="form-control" data-mfu-input="true" multiple />`
      ),
      div(
        {
          class: ["sc-mfu-dropzone", !showDrop && "d-none"],
          "data-mfu-dropzone": "true",
        },
        i({ class: "fas fa-cloud-upload-alt me-2" }),
        span(copy.dropLabel)
      ),
      div({ class: "text-muted small mt-2", "data-mfu-status": "true" })
    ) +
    div(
      {
        class: "alert alert-warning mt-3 d-none",
        "data-mfu-disabled": "true",
      },
      copy.disabledText
    )
  );
};

const get_state_fields = async (table_id) => {
  const table = Table.findOne({ id: table_id });
  return [
    {
      name: table.pk_name,
      type: "Integer",
      primary_key: true,
      required: true,
    },
  ];
};

const run = async (table_id, viewname, configuration, state, extra) => {
  const req = extra.req;
  const { parentTable, parentPk, childTable, fileField, fkField } =
    await resolveConfig(table_id, configuration);
  const parentId = state?.[parentPk];
  let listRows = [];
  if (configuration.show_existing !== false && parentId) {
    const where = { [fkField.name]: parentId };
    listRows = await childTable.getRows(where);
  }
  const copy = buildDefaultCopy(req);
  const listHtml = buildListHtml(
    listRows,
    childTable,
    fileField,
    configuration,
    req,
    copy
  );
  const clientCfg = buildClientConfig(viewname, parentId, configuration, copy);
  return div(
    {
      class: "sc-mfu",
      "data-mfu-root": "true",
      "data-mfu-config": text_attr(JSON.stringify(clientCfg)),
      "data-mfu-mode": clientCfg.mode,
    },
    configuration.show_existing !== false
      ? div({ class: "sc-mfu-list", "data-mfu-list": "true" }, listHtml)
      : "",
    renderControls(configuration, req, copy)
  );
};

const upload_files = async (
  table_id,
  viewname,
  configuration,
  body,
  { req }
) => {
  try {
    const parsed = await resolveConfig(table_id, configuration);
    const copy = buildDefaultCopy(req);
    const parentId = Number(body.row_id);
    if (!parentId) return { json: { error: req.__("Missing parent row id") } };
    const uploadsRaw = req.files && req.files.files;
    if (!uploadsRaw) return { json: { error: req.__("No files received") } };
    const uploads = Array.isArray(uploadsRaw) ? uploadsRaw : [uploadsRaw];
    const parentRow = await parsed.parentTable.getRow(
      { [parsed.parentPk]: parentId },
      { forUser: req.user }
    );
    if (!parentRow) return { json: { error: req.__("Parent row not found") } };
    const inserted = [];
    for (const upload of uploads) {
      const stored = await File.from_req_files(
        upload,
        req.user?.id,
        configuration.file_min_role || 1,
        configuration.target_folder || "/"
      );
      const file = Array.isArray(stored) ? stored[0] : stored;
      const newRow = {
        [parsed.fkField.name]: parentId,
        [parsed.fileField.name]: file.field_value,
      };
      const result = await parsed.childTable.tryInsertRow(newRow, req.user);
      if (result?.error) throw new Error(result.error);
      inserted.push(newRow);
    }
    let listHtml;
    if (configuration.show_existing !== false) {
      const rows = await parsed.childTable.getRows({
        [parsed.fkField.name]: parentId,
      });
      listHtml = buildListHtml(
        rows,
        parsed.childTable,
        parsed.fileField,
        configuration,
        req,
        copy
      );
    }
    return {
      json: {
        success: true,
        uploaded: inserted.length,
        listHtml,
      },
    };
  } catch (e) {
    return { json: { error: e.message } };
  }
};

const delete_file = async (
  table_id,
  viewname,
  configuration,
  body,
  { req }
) => {
  try {
    const parsed = await resolveConfig(table_id, configuration);
    const copy = buildDefaultCopy(req);
    const parentId = Number(body.row_id);
    const childId = Number(body.child_id);
    if (!parentId || !childId)
      return { json: { error: req.__("Missing identifiers") } };
    const rows = await parsed.childTable.getRows({ [parsed.childPk]: childId });
    const row = rows?.[0];
    if (!row || row[parsed.fkField.name] !== parentId)
      return { json: { error: req.__("File not found") } };
    let fileRecord = null;
    if (configuration.delete_from_store) {
      const storedFile = row[parsed.fileField.name];
      if (storedFile) fileRecord = await File.findOne(storedFile);
    }
    await parsed.childTable.deleteRows({ [parsed.childPk]: childId }, req.user);
    if (fileRecord) await fileRecord.delete();
    let listHtml;
    if (configuration.show_existing !== false) {
      const rowsAfter = await parsed.childTable.getRows({
        [parsed.fkField.name]: parentId,
      });
      listHtml = buildListHtml(
        rowsAfter,
        parsed.childTable,
        parsed.fileField,
        configuration,
        req,
        copy
      );
    }
    return { json: { success: true, listHtml } };
  } catch (e) {
    return { json: { error: e.message } };
  }
};

const headers = [
  {
    script: `/static_assets/${db.connectObj.version_tag}/multi-file-upload.js`,
    onlyViews: [VIEW_NAME],
  },
  {
    style: `
.sc-mfu { border: 1px solid var(--bs-border-color, #dee2e6); border-radius: 0.5rem; padding: 1rem; }
.sc-mfu-list { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.35rem; }
.sc-mfu-row { background: rgba(0,0,0,0.02); border-radius: 0.35rem; padding: 0.5rem 0.75rem; }
.sc-mfu-dropzone { border: 2px dashed var(--bs-border-color, #ced4da); border-radius: 0.5rem; padding: 1rem; text-align: center; cursor: pointer; color: var(--bs-secondary-color, #6c757d); transition: background 0.15s ease, border-color 0.15s ease; }
.sc-mfu-dropzone:hover { background: rgba(0,0,0,0.03); border-color: var(--bs-primary, #0d6efd); color: var(--bs-primary, #0d6efd); }
.sc-mfu-dropzone--active { border-color: var(--bs-primary, #0d6efd); color: var(--bs-primary, #0d6efd); background: rgba(13,110,253,0.08); }
.sc-mfu.sc-mfu-disabled, .sc-mfu.sc-mfu-uploading { opacity: 0.6; pointer-events: none; }
    `,
    onlyViews: [VIEW_NAME],
  },
];

module.exports = {
  name: VIEW_NAME,
  description:
    "Upload multiple files into a child table and show the related records inline.",
  configuration_workflow,
  get_state_fields,
  run,
  routes: { upload_files, delete_file },
  headers,
};
