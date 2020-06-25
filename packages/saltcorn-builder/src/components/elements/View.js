import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, MinRoleSetting } from "./utils";

export const View = ({ name, view }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return (
    <div ref={dom => connect(drag(dom))}>
      [{view}]
    </div>
  );
};

export const ViewSettings = () => {
  const { setProp, name, view } = useNode(node => ({
    name: node.data.props.name,
    view: node.data.props.block
  }));
  const options = useContext(optionsCtx);
  return (
    <div>
      <div>
        <label>View to show</label>
        <select
          value={view}
          onChange={e => setProp(prop => (prop.view = e.target.value))}
        >
          {options.views.map((f, ix) => (
            <option key={ix} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div>
          
      </div>
    </div>
  );
};

View.craft = {
  related: {
    settings: ViewSettings
  }
};
