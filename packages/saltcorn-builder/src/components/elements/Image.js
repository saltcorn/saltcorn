import React, { useContext, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleSetting } from "./utils";

export const Image = ({ fileid, block, alt }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <span {...blockProps(block)} ref={(dom) => connect(drag(dom))}>
      {fileid === 0 ? (
        "No images Available"
      ) : (
        <img
          className={`w-100 image-widget ${selected ? "selected-node" : ""}`}
          src={`/files/serve/${fileid}`}
          alt={alt}
        ></img>
      )}
    </span>
  );
};

export const ImageSettings = () => {
  const {
    actions: { setProp },
    fileid,
    alt,
    block,
  } = useNode((node) => ({
    fileid: node.data.props.name,
    alt: node.data.props.fieldview,
    block: node.data.props.block,
  }));
  const options = useContext(optionsCtx);
  return (
    <div>
      <div>
        <label>Image</label>
        <select
          value={fileid}
          className="form-control"
          onChange={(e) => setProp((prop) => (prop.fileid = e.target.value))}
        >
          {options.images.map((f, ix) => (
            <option key={ix} value={f.id}>
              {f.filename}
            </option>
          ))}
        </select>
      </div>
      <label>Alt text</label>
      <input
        type="text"
        className="form-control"
        value={alt}
        onChange={(e) => setProp((prop) => (prop.alt = e.target.value))}
      />
      <BlockSetting block={block} setProp={setProp} />
    </div>
  );
};

Image.craft = {
  displayName: "Image",
  defaultProps: {
    alt: "",
    block: false,
  },
  related: {
    settings: ImageSettings,
  },
};
