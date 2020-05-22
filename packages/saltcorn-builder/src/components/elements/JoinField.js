import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";

export const JoinField = ({ name, fieldview }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return (
    <div ref={dom => connect(drag(dom))}>
      [{name}]
    </div>
  );
};

export const JoinFieldSettings = () => {
  const { setProp, name } = useNode(node => ({
    name: node.data.props.name
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
     
    </div>
  );
};

JoinField.craft = {
  related: {
    settings: JoinFieldSettings
  }
};
