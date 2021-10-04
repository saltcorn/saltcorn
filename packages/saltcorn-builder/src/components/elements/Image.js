import React, { useContext, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleSetting, OrFormula } from "./utils";

export const Image = ({ fileid, block, srctype, url, alt }) => {
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
          className={`w-100 image-widget ${selected ? "selected-node" : ""}`}
          src={theurl}
          alt={alt}
        ></img>
      )}
    </span>
  );
};

export const ImageSettings = () => {
  const node = useNode((node) => ({
    fileid: node.data.props.fileid,
    field: node.data.props.field,
    url: node.data.props.url,
    filepath: node.data.props.filepath,
    srctype: node.data.props.srctype,
    alt: node.data.props.alt,
    uploadedFiles: node.data.props.uploadedFiles,
    block: node.data.props.block,
    isFormula: node.data.props.isFormula,
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
    uploadedFiles,
  } = node;
  const options = useContext(optionsCtx);
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
          console.log("Success:", result);
          setProp((prop) => {
            prop.fileid = result.success.id;
            prop.srctype = "File";
            prop.uploadedFiles = [
              ...prop.uploadedFiles,
              { id: result.success.id, filename: result.success.filename },
            ];
          });
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }
  };
  const setAProp = (key) => (e) => {
    if (e.target) {
      const target_value = e.target.value;
      setProp((prop) => (prop[key] = target_value));
    }
  };
  return (
    <table>
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
              className="form-control"
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
                className="form-control"
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
                className="form-control"
                onChange={setAProp("field")}
              >
                {options.fields
                  .filter(
                    (f) =>
                      f.type.name === "String" ||
                      f.reftable_name === "_sc_files"
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
            <td colSpan="2">
              <BlockSetting block={block} setProp={setProp} />
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

Image.craft = {
  displayName: "Image",
  defaultProps: {
    alt: "",
    block: false,
    isFormula: {},
    uploadedFiles: [],
    srctype: "File",
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
    ],
  },
};
