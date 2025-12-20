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
const FieldRepeat = require("../../models/fieldrepeat");
const { eval_expression } = require("../../models/expression");
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

const ACCEPT_SEP = /\s*,\s*/;
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
  const childFieldOptions = [];
  const orderFieldOptions = [];
  for (const childName of Object.keys(childTables)) {
    const childTable = childTables[childName];
    await childTable.getFields();
    childTable.fields.forEach((f) => {
      const label = `${childName}.${f.label || f.name}`;
      const option = optionWithName(label, `${childName}.${f.name}`);
      if (isFileField(f)) {
        fileFieldOptions.push(option);
      }
      orderFieldOptions.push(option);
      childFieldOptions.push(option);
    });
  }
  const unique = (list) =>
    list.filter(
      (opt, ix, arr) => arr.findIndex((o) => o.value === opt.value) === ix
    );
  return {
    relationOptions,
    fileFieldOptions: unique(fileFieldOptions),
    childFieldOptions: unique(childFieldOptions),
    orderFieldOptions: unique(orderFieldOptions),
  };
};

const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      {
        name: req.__("Upload settings"),
        form: async (context) => {
          const table = Table.findOne({ id: context.table_id });
          await table.getFields();
          const {
            relationOptions,
            fileFieldOptions,
            childFieldOptions,
            orderFieldOptions,
          } = await buildChildOptions(table);
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
                attributes: {
                  options: roles.map((r) => ({ value: r.id, label: r.role })),
                },
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
                name: "accept",
                label: req.__("Accepted file types"),
                type: "String",
                sublabel: req.__(
                  "Example: image/* or .pdf,.docx. Leave blank to allow any file."
                ),
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
                name: "order_field",
                label: req.__("Order by"),
                type: "String",
                attributes: { options: ["", ...orderFieldOptions] },
                sublabel: req.__(
                  "Optional field used to sort the child rows when rendering"
                ),
              },
              {
                name: "order_desc",
                label: req.__("Descending order"),
                type: "Bool",
                showIf: { order_field: orderFieldOptions.map((o) => o.value) },
              },
              {
                name: "drop_label",
                label: req.__("Drop zone text"),
                type: "String",
                default: req.__("Drop files here or click to browse"),
              },
              {
                name: "empty_text",
                label: req.__("Empty state text"),
                type: "String",
                default: req.__("No files uploaded yet"),
              },
              {
                name: "disabled_text",
                label: req.__("Message before record is saved"),
                type: "String",
                default: req.__("Save this record before uploading files."),
              },
              new FieldRepeat({
                name: "extra_values",
                label: req.__("Extra child field values"),
                fields: [
                  {
                    name: "field",
                    label: req.__("Child field"),
                    type: "String",
                    attributes: { options: childFieldOptions },
                  },
                  {
                    name: "formula",
                    label: req.__("Formula"),
                    input_type: "code",
                    attributes: {
                      mode: "application/javascript",
                      singleline: true,
                    },
                    sublabel: req.__(
                      "Use parent row values via their field names, or the special objects parent, file, and user"
                    ),
                  },
                ],
              }),
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
  const extraValues = (configuration.extra_values || [])
    .filter((row) => row && row.field && row.formula)
    .map(({ field, formula }) => {
      const { field: parsedName } = parseFieldRef(field);
      return { field: parsedName, formula };
    })
    .filter(({ field }) => !!childTable.getField(field));
  const orderField = configuration.order_field
    ? childTable.getField(parseFieldRef(configuration.order_field).field)
    : null;
  return {
    parentTable,
    parentPk: parentTable.pk_name,
    childTable,
    childPk: childTable.pk_name,
    fkField,
    fileField,
    extraValues,
    orderField,
  };
};

const fileMatchesAccept = (upload, accept) => {
  if (!accept) return true;
  const accepts = accept.split(ACCEPT_SEP).filter((s) => s.length);
  if (!accepts.length) return true;
  const mime = (upload.mimetype || "").toLowerCase();
  const extension = basename(upload.name || "")
    .split(".")
    .pop()
    ?.toLowerCase();
  return accepts.some((entry) => {
    if (!entry) return false;
    const token = entry.toLowerCase();
    if (token.endsWith("/*")) {
      const prefix = token.replace("/*", "");
      return mime.startsWith(prefix + "/");
    }
    if (token.startsWith(".")) return extension === token.replace(/^\./, "");
    return mime === token;
  });
};

const buildListHtml = (rows, childTable, fileField, cfg, req) => {
  if (!cfg.show_existing) return "";
  if (!rows || rows.length === 0)
    return div(
      { class: "sc-mfu-empty text-muted", "data-mfu-empty": "true" },
      cfg.empty_text || req.__("No files uploaded yet")
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

const buildClientConfig = (viewname, parentId, configuration, req) => ({
  viewname,
  rowId: parentId || null,
  mode: configuration.ui_mode || "input",
  accept: configuration.accept || "",
  allowDelete:
    configuration.allow_delete !== false &&
    configuration.show_existing !== false,
  showList: configuration.show_existing !== false,
  dropLabel:
    configuration.drop_label || req.__("Drop files here or click to browse"),
  emptyText: configuration.empty_text || req.__("No files uploaded yet"),
  disabledText:
    configuration.disabled_text ||
    req.__("Save this record before uploading files."),
  uploadLabel: req.__("Select files"),
  uploadingText: req.__("Uploading..."),
  successText: req.__("Files uploaded"),
  errorText: req.__("Could not upload files"),
  deleteConfirm: req.__("Remove this file?"),
});

const renderControls = (configuration, req) => {
  console.log("Rendering controls");
  const showDrop = configuration.ui_mode === "dropzone";
  return (
    div(
      { class: "mb-2" },
      span({ class: "form-label fw-semibold" }, req.__("Files")),
      div(
        { class: "sc-mfu-input" },
        `<input type="file" class="form-control" data-mfu-input="true" ${
          configuration.accept
            ? `accept="${text_attr(configuration.accept)}"`
            : ""
        } multiple />`
      ),
      div(
        {
          class: ["sc-mfu-dropzone", !showDrop && "d-none"],
          "data-mfu-dropzone": "true",
        },
        i({ class: "fas fa-cloud-upload-alt me-2" }),
        span(
          configuration.drop_label ||
            req.__("Drop files here or click to browse")
        )
      ),
      div({ class: "text-muted small mt-2", "data-mfu-status": "true" })
    ) +
    div(
      {
        class: "alert alert-warning mt-3 d-none",
        "data-mfu-disabled": "true",
      },
      configuration.disabled_text ||
        req.__("Save this record before uploading files.")
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
  const { parentTable, parentPk, childTable, fileField, orderField, fkField } =
    await resolveConfig(table_id, configuration);
  const parentId = state?.[parentPk];
  let listRows = [];
  if (configuration.show_existing !== false && parentId) {
    const where = { [fkField.name]: parentId };
    const selectOpts = orderField
      ? {
          orderBy: orderField.name,
          orderDesc: !!configuration.order_desc,
        }
      : {};
    listRows = await childTable.getRows(where, selectOpts);
  }
  const listHtml = buildListHtml(
    listRows,
    childTable,
    fileField,
    configuration,
    req
  );
  const clientCfg = buildClientConfig(viewname, parentId, configuration, req);
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
    renderControls(configuration, req)
  );
};

const applyExtraValues = (extraValues, parentRow, upload, req, childTable) => {
  const env = {
    ...parentRow,
    parent: parentRow,
    file: {
      filename: upload.name,
      mimetype: upload.mimetype,
      size: upload.size,
    },
  };
  const values = {};
  for (const extra of extraValues) {
    const field = childTable.getField(extra.field);
    if (!field) continue;
    values[field.name] = eval_expression(
      extra.formula,
      env,
      req.user,
      `Multi file upload extra value (${field.name})`
    );
  }
  return values;
};

const upload_files = async (
  table_id,
  viewname,
  configuration,
  body,
  { req }
) => {
  try {
    console.log("Upload files called");
    const parsed = await resolveConfig(table_id, configuration);
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
      if (!fileMatchesAccept(upload, configuration.accept)) {
        continue;
      }
      const stored = await File.from_req_files(
        upload,
        req.user?.id || 1,
        configuration.file_min_role || 1,
        configuration.target_folder || "/"
      );
      const file = Array.isArray(stored) ? stored[0] : stored;
      const newRow = {
        [parsed.fkField.name]: parentId,
        [parsed.fileField.name]: file.field_value,
      };
      Object.assign(
        newRow,
        applyExtraValues(
          parsed.extraValues,
          parentRow,
          upload,
          req,
          parsed.childTable
        )
      );
      const result = await parsed.childTable.tryInsertRow(newRow, req.user);
      if (result?.error) throw new Error(result.error);
      inserted.push(newRow);
    }
    let listHtml;
    if (configuration.show_existing !== false) {
      const selectOpts = parsed.orderField
        ? {
            orderBy: parsed.orderField.name,
            orderDesc: !!configuration.order_desc,
          }
        : {};
      const rows = await parsed.childTable.getRows(
        { [parsed.fkField.name]: parentId },
        selectOpts
      );
      listHtml = buildListHtml(
        rows,
        parsed.childTable,
        parsed.fileField,
        configuration,
        req
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
    const parentId = Number(body.row_id);
    const childId = Number(body.child_id);
    if (!parentId || !childId)
      return { json: { error: req.__("Missing identifiers") } };
    const rows = await parsed.childTable.getRows({ [parsed.childPk]: childId });
    const row = rows?.[0];
    if (!row || row[parsed.fkField.name] !== parentId)
      return { json: { error: req.__("File not found") } };
    await parsed.childTable.deleteRows({ [parsed.childPk]: childId }, req.user);
    let listHtml;
    if (configuration.show_existing !== false) {
      const selectOpts = parsed.orderField
        ? {
            orderBy: parsed.orderField.name,
            orderDesc: !!configuration.order_desc,
          }
        : {};
      const rowsAfter = await parsed.childTable.getRows(
        { [parsed.fkField.name]: parentId },
        selectOpts
      );
      listHtml = buildListHtml(
        rowsAfter,
        parsed.childTable,
        parsed.fileField,
        configuration,
        req
      );
    }
    return { json: { success: true, listHtml } };
  } catch (e) {
    return { json: { error: e.message } };
  }
};

module.exports = {
  name: VIEW_NAME,
  description:
    "Upload multiple files into a child table and show the related records inline.",
  configuration_workflow,
  get_state_fields,
  run,
  routes: { upload_files, delete_file },
};
