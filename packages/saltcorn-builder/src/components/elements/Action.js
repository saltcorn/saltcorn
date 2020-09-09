import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, MinRoleSetting } from "./utils";

export const Action = ({ name, block }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const btn = (
    <button
      className={`btn btn-primary`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
      {name}
    </button>
  );
  return selected ? <span className={"selected-node"}>{btn}</span> : btn;
};

export const ActionSettings = () => {
  const {
    actions: { setProp },
    name,
    block,
    minRole,
  } = useNode((node) => ({
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
  displayName: "Action",
  related: {
    settings: ActionSettings,
  },
};
