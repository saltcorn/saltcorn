import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, MinRoleSetting } from "./utils";

export const Action = ({ name, block }) => {
  const {
    connectors: { connect, drag },
  } = useNode();
  return (
    <button {...blockProps(block)} ref={(dom) => connect(drag(dom))}>
      {name}
    </button>
  );
};

export const ActionSettings = () => {
  const { setProp, name, block, minRole } = useNode((node) => ({
    name: node.data.props.name,
    block: node.data.props.block,
    minRole: node.data.props.minRole,
  }));
  const options = useContext(optionsCtx);
  return (
    <div>
      <div>
        <label>Action</label>

        <select
          value={name}
          onChange={(e) => setProp((prop) => (prop.name = e.target.value))}
        >
          {options.actions.map((f, ix) => (
            <option key={ix} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <BlockSetting block={block} setProp={setProp} />
      <MinRoleSetting minRole={minRole} setProp={setProp} />
    </div>
  );
};

Action.craft = {
  related: {
    settings: ActionSettings,
  },
};
