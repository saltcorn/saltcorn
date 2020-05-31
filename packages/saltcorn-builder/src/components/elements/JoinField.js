import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting } from "./utils";

export const JoinField = ({ name, block }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return (
    <span {...blockProps(block)} ref={dom => connect(drag(dom))}>
      [{name}]
    </span>
  );
};

export const JoinFieldSettings = () => {
  const { setProp, name, block } = useNode(node => ({
    name: node.data.props.name,
    block: node.data.props.block
  }));
  const options = useContext(optionsCtx);
  return (
    <div>
      <h6>Join Field settings</h6>
      <div>
        <select
          value={name}
          onChange={e => setProp(prop => (prop.name = e.target.value))}
        >
          {options.parent_field_list.map((f, ix) => (
            <option key={ix} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <BlockSetting block={block} setProp={setProp} />
    </div>
  );
};

JoinField.craft = {
  related: {
    settings: JoinFieldSettings
  }
};
