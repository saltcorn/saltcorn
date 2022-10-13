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
  /**
   * @namespace
   * @category saltcorn-data
   */
  "Download link": {
    /**
     * @param {string} file_id
     * @param {string} file_name
     * @returns {link}
     */
    run: (filePath) =>
      link(
        isNode()
          ? `/files/download/${(filePath)}`
          : `javascript:notifyAlert('File donwloads are not supported.')`,
        path.basename(filePath) || "Download"
      ),
  },
  /**
   * @namespace
   * @category saltcorn-data
   */
  Link: {
    /**
     * @param {string} file_id
     * @param {string} file_name
     * @returns {link}
     */
    run: (filePath) =>
      link(
        isNode()
          ? `/files/serve/${(filePath)}`
          : `javascript:openFile('${filePath}')`,
        path.basename(filePath) || "Open"
      ),
  },

  /**
   * @namespace
   * @category saltcorn-data
   */
  "Link (new tab)": {
    /**
     * @param {string} file_id
     * @param {string} file_name
     * @returns {a}
     */
    run: (filePath) =>
      a(
        isNode()
          ? { href: `/files/serve/${(filePath)}`, target: "_blank" }
          : { href: `javascript:openFile('${filePath}')` },
        path.basename(filePath) || "Open"
      ),
  },
  /**
   * @namespace
   * @category saltcorn-data
   */
  "Show Image": {
    /**
     * @param {string} file_id
     * @param {string} file_name
     * @returns {img}
     */
    run: (filePath) => {
      if (isNode())
        return img({ src: `/files/serve/${(filePath)}`, style: "width: 100%" });
      else {
        const rndid = `el${Math.floor(Math.random() * 16777215).toString(16)}`;
        return div(
          img({ style: "width: 100%", id: rndid }),
          script(domReady(`buildEncodedImage('${filePath}', '${rndid}')`))
        );
      }
    },
  },
  upload: {
    isEdit: true,
    multipartFormData: true,
    valueIsFilename: true,
    configFields: async () => {
      const dirs = await File.allDirectories()
      return [
        {
          name: "folder",
          label: "Folder",
          type: "String",
          attributes: { options: dirs.map(d => d.path_to_serve) }
        }
      ]
    },
    run: (nm, file_name, attrs, cls, reqd, field) => {
      return (
        text(file_name || "") +
        input({
          class: `${cls} ${field.class || ""}`,
          "data-fieldname": field.form_name,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          type: "file",
        })
      );
    },
  },
  select: {
    isEdit: true,
    setsFileId: true,
    configFields: async () => {
      const dirs = await File.allDirectories()
      return [
        {
          name: "folder",
          label: "Folder",
          type: "String",
          attributes: { options: dirs.map(d => d.path_to_serve) }
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
      ]
    },
    run: (nm, file_id, attrs, cls, reqd, field) => {
      return select(
        {
          class: `form-control form-select selectizable ${cls} ${field.class || ""}`,
          "data-fieldname": field.form_name,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
        },
        select_options(
          file_id,
          field,
          (attrs || {}).force_required,
          (attrs || {}).neutral_label
        )
      );
    },
  },
  Thumbnail: {
    configFields: () => [
      { name: "width", type: "Integer", label: "Width (px)" },
      { name: "height", type: "Integer", label: "Height (px)" },
      { name: "expand", type: "Bool", label: "Click to expand" },
    ],
    run: (filePath, file_name, cfg) => {
      const { width, height, expand } = cfg || {};
      if (isNode())
        return img({
          src: `/files/resize/${width || 50}/${height || 0}/${filePath}`,
          onclick: expand
            ? `expand_thumbnail('${filePath}', '${path.basename(filePath)}')`
            : undefined,
        });
      else {
        const elementId = `_sc_file_id_${filePath}_`;
        return div(
          img({ width, heigth, id: elementId }),
          script(domReady(`buildEncodedImage('${filePath}', '${elementId}')`))
        );
      }
    },
  },
};
