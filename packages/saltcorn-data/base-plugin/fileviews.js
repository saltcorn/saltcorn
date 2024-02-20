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
  button,
  i,
  div,
  span,
  text,
  text_attr,
  audio,
  video,
  source,
} = require("@saltcorn/markup/tags");
const { link } = require("@saltcorn/markup");
const { isNode } = require("../utils");
const { select_options } = require("@saltcorn/markup/helpers");
const File = require("../models/file");
const path = require("path");

module.exports = {
  // download link
  "Download link": {
    description: "Link to download file",
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
    description: "Link to open file",

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
    description: "Link to open file in new tab",

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
    description: "Show the file as an image",

    run: (filePath, file_name, cfg = {}) => {
      if (!filePath) return "";
      if (isNode())
        return img({
          src: `${cfg.targetPrefix || ""}/files/serve/${filePath}`,
          style: "width: 100%",
        });
      else {
        return img({
          "mobile-img-path": filePath,
          style: "width: 100%",
        });
      }
    },
  },
  // upload
  upload: {
    description: "Upload the file",

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
    description: "Select existing file",

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
    description:
      "Capture image, audio, or video with the user's camera or microphone",

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
      if (attrs.device === "camera" && attrs.isMobile) {
        return div(
          { class: "text-nowrap overflow-hidden text-truncate" },
          button(
            {
              id: `cptbtn${text_attr(nm)}`,
              class: "btn btn-primary",
              onclick: `getPicture('${text_attr(nm)}')`,
            },
            "use camera",
            i({ class: "ms-2 fas fa-camera" })
          ),
          span({ class: "ms-2", id: `cpt-file-name-${text_attr(nm)}` }, "")
        );
      } else {
        return input({
          class: `${cls} ${field.class || ""}`,
          "data-fieldname": field.form_name,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          type: "file",
          accept: `image/*;capture=${attrs.device}`,
        });
      }
    },
  },
  // Thumbnail
  Thumbnail: {
    configFields: () => [
      { name: "width", type: "Integer", required: true, label: "Width (px)" },
      { name: "height", type: "Integer", label: "Height (px)" },
      { name: "expand", type: "Bool", label: "Click to expand" },
    ],
    description: "Show the image file as small thumbnail image",

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
        // TODO resizer on mobile?
        const style = { width: `${width || 50}px` };
        if (height) style.height = `${height}px`;
        return img({
          "mobile-img-path": filePath,
          style,
        });
      }
    },
  },
  Audio: {
    description: "Simple audio player",

    run: (filePath, file_name, cfg = {}) => {
      if (!filePath) return "";

      return audio({
        src: `${cfg.targetPrefix || ""}/files/serve/${filePath}`,
        controls: true,
      });
    },
  },
  Video: {
    description: "Simple video player",
    configFields: [
      { name: "width", type: "Integer", label: "Width (px)" },
      { name: "height", type: "Integer", label: "Height (px)" },
      { name: "controls", type: "Bool", label: "Controls" },
      { name: "autoplay", type: "Bool", label: "Autoplay" },
      { name: "muted", type: "Bool", label: "Muted" },
    ],
    run: (filePath, file_name, cfg = {}) => {
      if (!filePath) return "";

      return video(
        {
          controls: cfg.controls,
          muted: cfg.muted,
          autoplay: cfg.autoplay,
          width: cfg.width || undefined,
          height: cfg.height || undefined,
        },
        source({
          src: `${cfg.targetPrefix || ""}/files/serve/${filePath}`,
          type: File.nameToMimeType(filePath),
        })
      );
    },
  },
};
