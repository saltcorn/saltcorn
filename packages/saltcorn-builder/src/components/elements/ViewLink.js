import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, MinRoleSetting } from "./utils";

export const ViewLink = ({ name, block, minRole, label }) => {
  const {
    connectors: { connect, drag },
  } = useNode();
  const names = name.split(":");
  const displabel = label || (names.length > 1 ? names[1] : names[0]);
  return (
    <span
      className="is-builder-link"
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
      {displabel}
    </span>
  );
};

export const ViewLinkSettings = () => {
  const {
    actions: { setProp },
    name,
    block,
    minRole,
    label,
  } = useNode((node) => ({
    name: node.data.props.name,
    block: node.data.props.block,
    minRole: node.data.props.minRole,
    label: node.data.props.label,
  }));
  const options = useContext(optionsCtx);
  return (
    <div>
      <div>
        <label>View to link to</label>
        <select
          value={name}
          onChange={(e) => setProp((prop) => (prop.name = e.target.value))}
        >
          {options.link_view_opts.map((f, ix) => (
            <option key={ix} value={f.name}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>Label (leave blank for default)</label>
        <input
          type="text"
          className="viewlink-label w-100"
          value={label}
          onChange={(e) => setProp((prop) => (prop.label = e.target.value))}
        />
      </div>
      <BlockSetting block={block} setProp={setProp} />
      <MinRoleSetting minRole={minRole} setProp={setProp} />
    </div>
  );
};

ViewLink.craft = {
  displayName: "ViewLink",
  related: {
    settings: ViewLinkSettings,
  },
};
