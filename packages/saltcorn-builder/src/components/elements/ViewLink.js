import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting } from "./utils";

export const ViewLink = ({ name, block }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  const names = name.split(":");
  const label = names.length > 1 ? names[1] : names[0];

  return <span {...blockProps(block)} ref={dom => connect(drag(dom))}>[{label}]</span>;
};

export const ViewLinkSettings = () => {
  const { setProp, name, block } = useNode(node => ({
    name: node.data.props.name,
    block: node.data.props.block
  }));
  const options = useContext(optionsCtx);
  return (
    <div>
      <h6>View Link settings</h6>
      <div>
        <select
          value={name}
          onChange={e => setProp(prop => (prop.name = e.target.value))}
        >
          {options.link_view_opts.map((f, ix) => (
            <option key={ix} value={f.name}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <BlockSetting block={block} setProp={setProp} />
    </div>
  );
};

ViewLink.craft = {
  related: {
    settings: ViewLinkSettings
  }
};
