/**
 * @category saltcorn-builder
 * @module components/elements/Image
 * @subcategory components / elements
 */

import React, { useContext, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import previewCtx from "../preview_context";
import { BoxModelEditor } from "./BoxModelEditor";

import {
  blockProps,
  BlockSetting,
  reactifyStyles,
  Accordion,
  OrFormula,
  setAPropGen,
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
  const Image = ({ fileid, block, srctype, url, alt, style }) => {
    const {
      selected,
      connectors: { connect, drag },
    } = useNode((node) => ({ selected: node.events.selected }));
    const theurl = srctype === "File" ? `/files/serve/${fileid}` : url;
    return (
      <span {...blockProps(block)} ref={(dom) => connect(drag(dom))}>
        {fileid === 0 ? (
          "No images Available"
        ) : (
          <img
            className={`${style && style.width ? "" : "w-100"} image-widget ${selected ? "selected-node" : ""
              }`}
            style={reactifyStyles(style || {})}
            src={theurl}
            alt={alt}
          ></img>
        )}
      </span>
    );
  };

export /**
 * @returns {table}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
  const ImageSettings = () => {
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
      imgResponsiveWidths: node.data.props.imgResponsiveWidths,
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
      style,
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
    return (
      <Accordion>
        <table accordiontitle="Select image">
          <tbody>
            <tr>
              <td colSpan="2">
                <i>
                  <small>Preview shown in canvas is indicative</small>
                </i>
              </td>
            </tr>
            <tr>
              <td>
                <label>Source</label>
              </td>
              <td>
                <select
                  value={srctype}
                  className="form-control form-select"
                  onChange={setAProp("srctype")}
                >
                  <option>File</option>
                  <option>URL</option>
                  <option>Upload</option>
                  {options.mode === "show" && <option>Field</option>}
                </select>
              </td>
            </tr>
            {srctype === "File" && (
              <tr>
                <td>
                  <label>File</label>
                </td>
                <td>
                  <select
                    value={fileid}
                    className="form-control form-select"
                    onChange={setAProp("fileid")}
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
                  <label>URL</label>
                </td>
                <td>
                  <OrFormula nodekey="url" {...{ setProp, isFormula, node }}>
                    <input
                      type="text"
                      className="form-control"
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
                  <label>File</label>
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
                  <label>Field</label>
                </td>
                <td>
                  <select
                    value={field}
                    className="form-control form-select"
                    onChange={setAProp("field")}
                  >
                    <option value=""></option>
                    {options.fields
                      .filter(
                        (f) =>
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
                  <label>Alt text</label>
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
                  <label>Responsive widths</label>
                </td>

                <td>
                  <input
                    type="text"
                    value={imgResponsiveWidths}
                    className="form-control"
                    onChange={setAProp("imgResponsiveWidths")}
                  />
                  <small>
                    <i>
                      List of widths to serve resized images, e.g. 300, 400, 600
                    </i>
                  </small>
                </td>
              </tr>
            )}
            {srctype !== "Upload" && (
              <tr>
                <td colSpan="2">
                  <BlockSetting block={block} setProp={setProp} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div accordiontitle="Box" className="w-100">
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
      "block",
      "imgResponsiveWidths",
      { name: "style", default: {} },
    ],
  },
};
