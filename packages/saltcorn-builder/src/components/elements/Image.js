/**
 * @category saltcorn-builder
 * @module components/elements/Image
 * @subcategory components / elements
 */

import React, { useContext, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import previewCtx from "../preview_context";
import useTranslation from "../../hooks/useTranslation";
import { BoxModelEditor } from "./BoxModelEditor";

import {
  blockProps,
  BlockSetting,
  reactifyStyles,
  Accordion,
  OrFormula,
  setAPropGen,
  buildOptions,
  SettingsRow,
} from "./utils";

export /**
 * @param {object} props
 * @param {string} props.fileid
 * @param {boolean} props.block
 * @param {string} props.srctype
 * @param {string} props.url
 * @param {string} props.alt
 * @returns {span}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const Image = ({ fileid, block, srctype, url, alt, style, customClass }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const { t } = useTranslation();
  const theurl =
    srctype === "File"
      ? /^(?:[a-z]+:)?\/\//i.test(fileid)
        ? fileid
        : `/files/serve/${fileid}`
      : url;
  return fileid === 0 ? (
    <span
      {...blockProps(block)}
      className={`${style && style.width ? "" : "w-100"} ${customClass || ""} image-widget ${
        selected ? "selected-node" : ""
      }`}
      ref={(dom) => connect(drag(dom))}
      style={reactifyStyles(style || {})}
    >
      {t("No images Available")}
    </span>
  ) : (
    <img
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
      className={`${style && style.width ? "" : "w-100"} ${customClass || ""} image-widget ${
        selected ? "selected-node" : ""
      }`}
      style={reactifyStyles(style || {})}
      src={theurl}
      alt={alt}
    ></img>
  );
};

export /**
 * @returns {table}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const ImageSettings = () => {
  const { t } = useTranslation();
  const node = useNode((node) => ({
    fileid: node.data.props.fileid,
    field: node.data.props.field,
    url: node.data.props.url,
    filepath: node.data.props.filepath,
    srctype: node.data.props.srctype,
    alt: node.data.props.alt,
    block: node.data.props.block,
    style: node.data.props.style,
    isFormula: node.data.props.isFormula,
    customClass: node.data.props.customClass,
    imgResponsiveWidths: node.data.props.imgResponsiveWidths,
    currentSettingsTab: node.data.props.currentSettingsTab,
  }));
  const {
    actions: { setProp },
    fileid,
    srctype,
    field,
    url,
    alt,
    block,
    isFormula,
    filepath,
    imgResponsiveWidths,
    customClass,
    style,
    currentSettingsTab,
  } = node;
  const options = useContext(optionsCtx);
  const { uploadedFiles, setUploadedFiles } = useContext(previewCtx);

  const handleUpload = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const formData = new FormData();

      formData.append("file", e.target.files[0]);
      formData.append("min_role_read", options.min_role || 1);

      fetch("/files/upload", {
        method: "POST",
        body: formData,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "CSRF-Token": options.csrfToken,
        },
      })
        .then((response) => response.json())
        .then((result) => {
          setUploadedFiles((upFls) => [
            ...upFls,
            { id: result.success.location, filename: result.success.filename },
          ]);
          setProp((prop) => {
            prop.fileid = result.success.location;
            prop.srctype = "File";
          });
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }
  };
  const setAProp = setAPropGen(setProp);
  const sourceOpts = ["File", "URL", "Upload"];
  if (options.mode === "show") sourceOpts.push("Field");
  return (
    <Accordion
      value={currentSettingsTab}
      onChange={(ix) => setProp((prop) => (prop.currentSettingsTab = ix))}
    >
      <table accordiontitle={t("Select image")}>
        <tbody>
          <tr>
            <td colSpan="2">
              <i>
                <small>{t("Preview shown in canvas is indicative")}</small>
              </i>
            </td>
          </tr>
          <tr>
            <td>
              <label>{t("Source")}</label>
            </td>
            <td>
              <select
                value={srctype}
                 className="form-control form-select"
                onChange={setAProp("srctype")}
              >
                {buildOptions(sourceOpts)}
              </select>
            </td>
          </tr>
          {srctype === "File" && (
            <tr>
              <td>
                <label>{t("File")}</label>
              </td>
              <td>
                <select
                  value={fileid}
                  className="form-control form-select"
                  onChange={setAProp("fileid")}
                  onBlur={setAProp("fileid")}
                >
                  {options.images.map((f, ix) => (
                    <option key={ix} value={f.id}>
                      {f.filename}
                    </option>
                  ))}
                  {(uploadedFiles || []).map((uf, ix) => (
                    <option key={ix} value={uf.id}>
                      {uf.filename}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          )}
          {srctype === "URL" && (
            <tr>
              <td>
                <label>{t("URL")}</label>
              </td>
              <td>
                <OrFormula nodekey="url" {...{ setProp, isFormula, node }}>
                  <input
                    type="text"
                    className="form-control"
                    spellCheck={false}
                    value={url}
                    onChange={setAProp("url")}
                  />
                </OrFormula>
              </td>
            </tr>
          )}
          {srctype === "Upload" && (
            <tr>
              <td>
                <label>{t("File")}</label>
              </td>
              <td>
                <input
                  type="file"
                  className="form-control"
                  value={filepath}
                  onChange={handleUpload}
                />
              </td>
            </tr>
          )}
          {srctype === "Field" && (
            <tr>
              <td>
                <label>{t("Field")}</label>
              </td>
              <td>
                <select
                  value={field}
                  className="field form-control form-select"
                  onChange={setAProp("field")}
                >
                  <option value=""></option>
                  {options.fields
                    .filter(
                      (f) =>
                        f.type === "String" ||
                        (f.type && f.type.name === "String") ||
                        (f.type && f.type === "File")
                    )
                    .map((f, ix) => (
                      <option key={ix} value={f.name}>
                        {f.label}
                      </option>
                    ))}
                </select>
              </td>
            </tr>
          )}
          {srctype !== "Upload" && (
            <tr>
              <td>
                <label>{t("Alt text")}</label>
              </td>
              <td>
                <OrFormula nodekey="alt" {...{ setProp, isFormula, node }}>
                  <input
                    type="text"
                    className="form-control"
                    value={alt}
                    onChange={setAProp("alt")}
                  />
                </OrFormula>
              </td>
            </tr>
          )}
          {srctype !== "Upload" && (
            <tr>
              <td style={{ verticalAlign: "top" }}>
                <label>{t("Responsive widths")}</label>
              </td>

              <td>
                <input
                  type="text"
                  value={imgResponsiveWidths}
                  spellCheck={false}
                  className="form-control"
                  onChange={setAProp("imgResponsiveWidths")}
                />
                <small>
                  <i>
                    {t(
                      "List of widths to serve resized images, e.g. 300, 400, 600"
                    )}
                  </i>
                </small>
              </td>
            </tr>
          )}
          <SettingsRow
            field={{
              name: "object-fit",
              label: t("Object fit"),
              type: "select",
              options: ["none", "fill", "contain", "cover", "scale-down"],
            }}
            node={node}
            setProp={setProp}
            isStyle={true}
          />
          <tr>
            <td>{t("Class")}</td>
            <td>
              <input
                type="text"
                value={customClass}
                className="form-control"
                onChange={setAProp("customClass")}
                spellCheck={false}
              />
            </td>
          </tr>
          {srctype !== "Upload" && (
            <tr>
              <td colSpan="2">
                <BlockSetting block={block} setProp={setProp} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div accordiontitle={t("Box")} className="w-100">
        <BoxModelEditor setProp={setProp} node={node} sizeWithStyle={true} />
      </div>
    </Accordion>
  );
};

/**
 * @type {object}
 */
Image.craft = {
  displayName: "Image",
  defaultProps: {
    alt: "",
    block: false,
    isFormula: {},
    srctype: "File",
    style: {},
  },
  related: {
    settings: ImageSettings,
    segment_type: "image",
    fields: [
      { name: "alt", canBeFormula: true },
      { name: "url", canBeFormula: true },
      { name: "srctype", default: "File" },
      { name: "fileid", default: 0 },
      "field",
      "customClass",
      "block",
      "imgResponsiveWidths",
      { name: "style", default: {} },
    ],
  },
};
