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
  textarea,
  with_curScript,
  escape,
} = require("@saltcorn/markup/tags");
const { link } = require("@saltcorn/markup");
const { isNode } = require("../utils");
const { select_options } = require("@saltcorn/markup/helpers");
const File = require("../models/file");
const path = require("path");
const { getReq__ } = require("../db/state");

const buildNodeFileUrl = (filePath, cfg = {}, opts = {}) =>
  File.pathToServeUrl(filePath, {
    download: opts.download,
    filename: opts.filename,
    targetPrefix: cfg.targetPrefix || "",
    preferDirect: opts.preferDirect,
  });

const buildNodeFileLinkUrl = (filePath, cfg = {}) =>
  buildNodeFileUrl(filePath, cfg);

const btnStyles = [
  { name: "default", label: "Default selector" },
  { name: "btn btn-primary", label: "Primary button" },
  { name: "btn btn-secondary", label: "Secondary button" },
  { name: "btn btn-success", label: "Success button" },
  { name: "btn btn-danger", label: "Danger button" },
  { name: "btn btn-warning", label: "Warning button" },
  { name: "btn btn-info", label: "Info button" },
  {
    name: "btn btn--outline-primary",
    label: "Primary outline button",
  },
  {
    name: "btn btn--outline-decondary",
    label: "Secondary outline button",
  },
];

const btnStylesForLink = [
  { name: " ", label: "Link" },
  { name: "btn btn-primary", label: "Primary button" },
  { name: "btn btn-secondary", label: "Secondary button" },
  { name: "btn btn-success", label: "Success button" },
  { name: "btn btn-danger", label: "Danger button" },
  { name: "btn btn-warning", label: "Warning button" },
  { name: "btn btn-info", label: "Info button" },
  {
    name: "btn btn-outline-primary",
    label: "Primary outline button",
  },
  {
    name: "btn btn-outline-decondary",
    label: "Secondary outline button",
  },
];

const buildCustomInput = (id, attrs, file_name) => {
  const __ = getReq__();
  return (
    button(
      {
        type: "button",
        id: `${id}-custom-button`,
        class: attrs.button_style,
        onclick: `$(this).parent().find("input").click()`,
      },
      attrs?.label ? attrs.label : __("Choose File")
    ) +
    span(
      {
        id: `${id}-custom-text`,
        class: "custom-file-label",
      },
      !file_name ? __("No file chosen") : ""
    ) +
    script(
      with_curScript(`curScript.parentNode.querySelector("input").addEventListener('change', (e) => {
          curScript.parentNode.querySelector("span").textContent = e.target.files[0].name;
        });`)
    )
  );
};

module.exports = {
  // download link
  "Download link": {
    configFields: [
      {
        name: "button_style",
        label: "Style",
        type: "String",
        required: true,
        attributes: {
          options: btnStylesForLink,
        },
      },
    ],
    description: "Link to download file",
    run: (filePath, file_name, cfg = {}) => {
      if (!filePath) return "";
      return link(
        isNode()
          ? buildNodeFileUrl(filePath, cfg, {
              download: true,
              filename: file_name,
            })
          : `javascript:notifyAlert('File donwloads are not supported.')`,
        path.basename(filePath) || "Download",
        cfg?.button_style && cfg?.button_style !== " "
          ? { class: cfg?.button_style }
          : undefined
      );
    },
  },
  // Link
  Link: {
    configFields: [
      {
        name: "button_style",
        label: "Style",
        type: "String",
        required: true,
        attributes: {
          options: btnStylesForLink,
        },
      },
    ],
    description: "Link to open file",

    run: (filePath, file_name, cfg = {}) =>
      !filePath
        ? ""
        : link(
            isNode()
              ? buildNodeFileLinkUrl(filePath, cfg)
              : `javascript:openFile('${filePath}')`,
            path.basename(filePath) || "Open",
            cfg?.button_style && cfg?.button_style !== " "
              ? { class: cfg?.button_style }
              : undefined
          ),
  },

  // Link (new tab)
  "Link (new tab)": {
    description: "Link to open file in new tab",
    configFields: [
      {
        name: "button_style",
        label: "Style",
        type: "String",
        required: true,
        attributes: {
          options: btnStylesForLink,
        },
      },
    ],
    run: (filePath, file_name, cfg = {}) =>
      !filePath
        ? ""
        : link(
            isNode()
              ? buildNodeFileLinkUrl(filePath, cfg)
              : `javascript:openFile('${filePath}')`,
            path.basename(filePath) || "Open",
            cfg?.button_style && cfg?.button_style !== " "
              ? { target: "_blank", class: cfg?.button_style }
              : { target: "_blank" }
          ),
  },
  // Show Image
  "Show Image": {
    description: "Show the file as an image",

    run: (filePath, file_name, cfg = {}) => {
      if (!filePath) return "";
      if (isNode())
        return img({
          // Prefer proxied /files/serve URLs so CSP does not block inline images
          src: buildNodeFileUrl(filePath, cfg, { preferDirect: false }),
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
        {
          name: "button_style",
          label: "Button Style",
          type: "String",
          attributes: {
            options: btnStyles,
          },
          default: "default",
        },
        {
          name: "label",
          label: "Button Label",
          type: "String",
          showIf: {
            button_style: btnStyles
              .filter((opt) => opt.name !== "default")
              .map((opt) => opt.name),
          },
        },
      ];
    },
    run: (nm, file_name, attrs, cls, reqd, field) => {
      //console.log("in run attrs.files_accept_filter", attrs.files_accept_filter);
      const customInput =
        attrs?.button_style &&
        attrs.button_style !== "default" &&
        attrs.button_style !== " ";
      const id = `input${text_attr(nm)}`;
      return (
        input({
          class: [cls, field.class, file_name && "file-has-existing"],
          "data-fieldname": field.form_name,
          name: text_attr(nm),
          id: id,
          type: "file",
          disabled: attrs.disabled,
          onChange: attrs.onChange,
          readonly: attrs.readonly,
          "data-on-cloned": "clear_cloned_file_input(this)",
          accept: attrs.files_accept_filter || undefined,
          ...(customInput ? { hidden: true } : {}),
        }) +
        (customInput ? buildCustomInput(id, attrs, file_name) : "") +
        span({ class: "file-upload-exising" }, text(file_name || ""))
      );
    },
  },
  // select
  select: {
    isEdit: true,
    setsFileId: true,
    description: "Select existing file",
    fill_options: async (field) => {
      const files = await File.find(
        field.attributes.folder
          ? { folder: field.attributes.folder }
          : field.attributes.select_file_where || {}
      );
      const extRe =
        field.attributes.file_exts &&
        new RegExp(
          `\\.(${field.attributes.file_exts
            .split(",")
            .map((s) => s.trim())
            .join("|")})$`,
          "i"
        );
      field.options = files
        .filter(
          (f) => !f.isDirectory && (!extRe || extRe.test(f.path_to_serve))
        )
        .map((f) => ({
          label: f.filename,
          value: f.path_to_serve,
        }));
      if (!this.required) field.options.unshift({ label: "", value: "" });
    },
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
          name: "use_picker",
          label: "Use picker",
          sublabel: "Use the file picker dialog",
          type: "Bool",
          default: false,
        },
        {
          name: "show_subdirs",
          type: "Bool",
          label: "navigate subdirectories",
          sublabel: "Show and allow to navigate directories",
          showIf: { use_picker: true },
          default: false,
        },
        {
          name: "file_exts",
          label: "File extensions",
          type: "String",
          subfolder:
            "Comma separated file extensions. Example: <code>jpg,png</code>",
        } /*
        {
          name: "mime_regex",
          label: "MIME regex",
          type: "String"
        }*/,
      ];
    },
    // run
    run: (nm, file_id, attrs, cls, reqd, field) => {
      if (attrs?.use_picker) {
        const folder = attrs?.folder || "";
        const inputId = `input${text_attr(nm)}__${Math.floor(Math.random() * 16777215).toString(16)}`;
        return span(
          a(
            {
              class: "btn btn-secondary",
              href: `javascript:ajax_modal('/files/picker?folder=${encodeURIComponent(
                folder
              )}&input_id=${encodeURIComponent(inputId)}${
                attrs?.show_subdirs === false ? "&no_subdirs=true" : ""
              }${attrs?.file_exts ? "&file_exts=" + attrs?.file_exts : ""}')`,
            },
            "select"
          ),
          span(
            {
              id: `${inputId}-custom-text`,
              class: "custom-file-label",
            },
            file_id || "No file chosen"
          ),
          input({
            type: "hidden",
            id: inputId,
            name: text_attr(nm),
            "data-fieldname": field.form_name,
            value: file_id || false,
          })
        );
      } else {
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
      }
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
        {
          name: "button_style",
          label: "Button Style",
          type: "String",
          attributes: {
            options: btnStyles,
          },
          default: "default",
        },
        {
          name: "label",
          label: "Button Label",
          type: "String",
          showIf: {
            button_style: btnStyles
              .filter((opt) => opt.name !== "default")
              .map((opt) => opt.name),
          },
        },
      ];
    },
    run: (nm, file_name, attrs, cls, reqd, field) => {
      const customInput =
        attrs?.button_style && attrs.button_style !== "default";
      const id = `input${text_attr(nm)}`;

      if (attrs.device === "camera" && attrs.isMobile) {
        return div(
          { class: "text-nowrap overflow-hidden text-truncate" },
          button(
            {
              id: `cptbtn${text_attr(nm)}`,
              class: attrs?.button_style
                ? attrs.button_style
                : "btn btn-primary",
              onclick: `getPicture('${text_attr(nm)}')`,
            },
            "use camera",
            i({ class: "ms-2 fas fa-camera" })
          ),
          span({ class: "ms-2", id: `cpt-file-name-${text_attr(nm)}` }, "")
        );
      } else {
        const mimebase = {
          camera: "image",
          camcorder: "video",
          microphone: "audio",
        }[attrs.device];
        return (
          input({
            class: `${cls} ${field.class || ""}`,
            "data-fieldname": field.form_name,
            name: text_attr(nm),
            id: id,
            type: "file",
            "data-on-cloned": "$(this).val('')",
            accept: `${mimebase}/*;capture=${attrs.device}`,
            ...(customInput ? { hidden: true } : {}),
          }) + (customInput ? buildCustomInput(id, attrs) : "")
        );
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
        src: buildNodeFileUrl(filePath, cfg),
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
      { name: "loop", type: "Bool", label: "Loop" },
      { name: "fullscreen", type: "Bool", label: "Full screen" },
    ],
    run: (filePath, file_name, cfg = {}) => {
      if (!filePath) return "";

      return video(
        {
          controls: cfg.controls,
          muted: cfg.muted,
          loop: cfg.loop,
          autoplay: cfg.autoplay,
          width: cfg.width || undefined,
          height: cfg.height || undefined,
          style: cfg.fullscreen
            ? `height: 100vh; width: 100%; object-fit: fill; position: absolute;`
            : undefined,
        },
        source({
          src: buildNodeFileUrl(filePath, cfg),
          type: File.nameToMimeType(filePath),
        })
      );
    },
  },
  TextEditor: {
    isEdit: true,
    multipartFormData: true,
    editContent: true,
    description:
      "Capture image, audio, or video with the user's camera or microphone",

    configFields: async () => {
      const dirs = await File.allDirectories();
      return [
        {
          name: "edit_file_name",
          label: "Edit file name",
          type: "String",
          required: true,
          attributes: { options: ["Never", "Always", "Only if new file"] },
        },
      ];
    },
    run: (nm, file_name, attrs, cls, reqd, field, row) => {
      //console.trace({ nm, file_name, attrs, cls, reqd, field, row });
      const contents = row?.[`_content_${nm}`]?.toString?.() || "";
      const edit_file_name =
        attrs?.edit_file_name === "Always" ||
        (attrs?.edit_file_name === "Only if new file" && !file_name);
      return (
        input({
          type: edit_file_name ? "text" : "hidden",
          class: edit_file_name ? "form-control" : undefined,
          placeholder: edit_file_name ? "File name" : undefined,
          name: text_attr(nm),
          "data-fieldname": text_attr(field.name),
          value: file_name ? text_attr(file_name) : undefined,
        }) +
        textarea(
          {
            name: `_content_${text_attr(nm)}`,
            class: ["form-control", "to-code", cls],
            disabled: attrs.disabled,
            onChange: attrs.onChange,
            readonly: attrs.readonly,
            placeholder: attrs.placeholder,
            spellcheck: "false",
            required: !!reqd,
            id: `input${text_attr(nm)}`,
            mode: file_name ? File.nameToMimeType(file_name) : undefined,
          },
          escape(contents)
        )
      );
    },
  },
};
