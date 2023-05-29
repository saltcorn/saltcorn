/**
 * @category saltcorn-data
 * @module base-plugin/fileview
 * @subcategory base-plugin
 */
const {
  a,
  img,
  script,
  domReady,
  select,
  input,
  div,
  text,
  text_attr,
} = require("@saltcorn/markup/tags");
const { link } = require("@saltcorn/markup");
const { isNode } = require("../utils");
const { select_options } = require("@saltcorn/markup/helpers");
const File = require("../models/file");
const path = require("path");

module.exports = {
  // download link
  "Download link": {
    run: (filePath, file_name, cfg = {}) => {
      if (!filePath) return "";
      return link(
        isNode()
          ? `${cfg.targetPrefix || ""}/files/download/${filePath}`
          : `javascript:notifyAlert('File donwloads are not supported.')`,
        path.basename(filePath) || "Download"
      );
    },
  },
  // Link
  Link: {
    run: (filePath, file_name, cfg = {}) =>
      !filePath
        ? ""
        : link(
            isNode()
              ? `${cfg.targetPrefix || ""}/files/serve/${filePath}`
              : `javascript:openFile('${filePath}')`,
            path.basename(filePath) || "Open"
          ),
  },

  // Link (new tab)
  "Link (new tab)": {
    run: (filePath, file_name, cfg = {}) =>
      !filePath
        ? ""
        : a(
            isNode()
              ? {
                  href: `${cfg.targetPrefix || ""}/files/serve/${filePath}`,
                  target: "_blank",
                }
              : { href: `javascript:openFile('${filePath}')` },
            path.basename(filePath) || "Open"
          ),
  },
  // Show Image
  "Show Image": {
    run: (filePath, file_name, cfg = {}) => {
      if (!filePath) return "";
      if (isNode())
        return img({
          src: `${cfg.targetPrefix || ""}/files/serve/${filePath}`,
          style: "width: 100%",
        });
      else {
        const rndid = `el${Math.floor(Math.random() * 16777215).toString(16)}`;
        return div(
          img({ style: "width: 100%", id: rndid }),
          script(domReady(`buildEncodedImage('${filePath}', '${rndid}')`))
        );
      }
    },
  },
  // upload
  upload: {
    isEdit: true,
    multipartFormData: true,
    valueIsFilename: true,

    configFields: async () => {
      const dirs = await File.allDirectories();
      return [
        {
          name: "folder",
          label: "Folder",
          type: "String",
          attributes: { options: dirs.map((d) => d.path_to_serve) },
        },
      ];
    },
    run: (nm, file_name, attrs, cls, reqd, field) => {
      //console.log("in run attrs.files_accept_filter", attrs.files_accept_filter);
      return (
        text(file_name || "") +
        (typeof attrs.files_accept_filter !== "undefined" ||
        attrs.files_accept_filter !== null
          ? input({
              class: `${cls} ${field.class || ""}`,
              "data-fieldname": field.form_name,
              name: text_attr(nm),
              id: `input${text_attr(nm)}`,
              type: "file",
              accept: attrs.files_accept_filter,
            })
          : input({
              class: `${cls} ${field.class || ""}`,
              "data-fieldname": field.form_name,
              name: text_attr(nm),
              id: `input${text_attr(nm)}`,
              type: "file",
            }))
      );
    },
  },
  // select
  select: {
    isEdit: true,
    setsFileId: true,
    configFields: async () => {
      const dirs = await File.allDirectories();
      return [
        {
          name: "folder",
          label: "Folder",
          type: "String",
          attributes: { options: dirs.map((d) => d.path_to_serve) },
        },
        /*{
          name: "name_regex",
          label: "Name regex",
          type: "String"
        },
        {
          name: "mime_regex",
          label: "MIME regex",
          type: "String"
        }*/
      ];
    },
    // run
    run: (nm, file_id, attrs, cls, reqd, field) => {
      return select(
        {
          class: `form-control form-select selectizable ${cls} ${
            field.class || ""
          }`,
          "data-fieldname": field.form_name,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
        },
        select_options(
          file_id,
          field,
          (attrs || {}).force_required, // todo force_required is unresolved!
          (attrs || {}).neutral_label
        )
      );
    },
  },
  // Capture
  Capture: {
    isEdit: true,
    multipartFormData: true,
    valueIsFilename: true,

    configFields: async () => {
      const dirs = await File.allDirectories();
      return [
        {
          name: "folder",
          label: "Folder",
          type: "String",
          attributes: { options: dirs.map((d) => d.path_to_serve) },
        },
        {
          name: "device",
          label: "Device",
          type: "String",
          required: true,
          attributes: { options: ["camera", "camcorder", "microphone"] },
        },
      ];
    },
    run: (nm, file_name, attrs, cls, reqd, field) => {
      return input({
        class: `${cls} ${field.class || ""}`,
        "data-fieldname": field.form_name,
        name: text_attr(nm),
        id: `input${text_attr(nm)}`,
        type: "file",
        accept: `image/*;capture=${attrs.device}`,
      });
    },
  },
  // Thumbnail
  Thumbnail: {
    configFields: () => [
      { name: "width", type: "Integer", required: true, label: "Width (px)" },
      { name: "height", type: "Integer", label: "Height (px)" },
      { name: "expand", type: "Bool", label: "Click to expand" },
    ],
    run: (filePath, file_name, cfg = {}) => {
      const { width, height, expand, targetPrefix } = cfg || {};
      if (!filePath) return "";
      if (isNode())
        return img({
          src: `${targetPrefix || ""}/files/resize/${width || 50}/${
            height || 0
          }/${filePath}`,
          onclick: expand
            ? `expand_thumbnail('${filePath}', '${path.basename(filePath)}')`
            : undefined,
        });
      else {
        const elementId = `_sc_file_id_${filePath}_`;
        return div(
          img({ width, height, id: elementId }),
          script(domReady(`buildEncodedImage('${filePath}', '${elementId}')`))
        );
      }
    },
  },
};
