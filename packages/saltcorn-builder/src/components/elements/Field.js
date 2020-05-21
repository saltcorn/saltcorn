import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";

export const Field = ({ name }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return <div ref={dom => connect(drag(dom))}>[{name}]</div>;
};

export const FieldSettings = () => {
  const { setProp, name } = useNode(node => ({
    name: node.data.props.name
  }));
  const options = useContext(optionsCtx);
  console.log("FieldSettings", options);
  return (
    <div>
      <h6>Field settings</h6>
      <select
        value={name}
        onChange={e => setProp(prop => (prop.name = e.target.value))}
      >
        {options.fields.map((f, ix) => (
          <option key={ix} value={f.name}>
            {f.label}
          </option>
        ))}
      </select>
    </div>
  );
};

Field.craft = {
  related: {
    settings: FieldSettings
  }
};
