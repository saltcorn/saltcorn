import React from "react";
import { useNode } from "@craftjs/core";

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
  return (
    <div>
      <h6>Field settings</h6>
      <input
        type="text"
        value={name}
        onChange={e => setProp(prop => (prop.name = e.target.value))}
      />
    </div>
  );
};

Field.craft = {
  related: {
    settings: FieldSettings
  }
};
