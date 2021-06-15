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
    srctype: node.data.props.srctype,
    alt: node.data.props.fieldview,
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
  } = node;
  const options = useContext(optionsCtx);
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
              onChange={(e) =>
                setProp((prop) => (prop.srctype = e.target.value))
              }
            >
              <option>File</option>
              <option>URL</option>
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
                onChange={(e) =>
                  setProp((prop) => (prop.fileid = e.target.value))
                }
              >
                {options.images.map((f, ix) => (
                  <option key={ix} value={f.id}>
                    {f.filename}
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
                  onChange={(e) =>
                    setProp((prop) => (prop.url = e.target.value))
                  }
                />
              </OrFormula>
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
                onChange={(e) =>
                  setProp((prop) => (prop.field = e.target.value))
                }
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
                onChange={(e) => setProp((prop) => (prop.alt = e.target.value))}
              />
            </OrFormula>
          </td>
        </tr>
        <tr>
          <td colSpan="2">
            <BlockSetting block={block} setProp={setProp} />
          </td>
        </tr>
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
