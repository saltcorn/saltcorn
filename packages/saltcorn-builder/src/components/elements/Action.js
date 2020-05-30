import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";

export const Action = ({ name }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return <button ref={dom => connect(drag(dom))}>{name}</button>;
};

export const ActionSettings = () => {
  const { setProp, name } = useNode(node => ({
    name: node.data.props.name
  }));
  const options = useContext(optionsCtx);
  return (
    <div>
      <h6>Action settings</h6>
      <div>
        <select
          value={name}
          onChange={e => setProp(prop => (prop.name = e.target.value))}
        >
          {options.actions.map((f, ix) => (
            <option key={ix} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

Action.craft = {
  related: {
    settings: ActionSettings
  }
};
