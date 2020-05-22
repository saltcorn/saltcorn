import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";

export const ViewLink = ({ name }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return (
    <div ref={dom => connect(drag(dom))}>
      [{name}]
    </div>
  );
};

export const ViewLinkSettings = () => {
  const { setProp, name } = useNode(node => ({
    name: node.data.props.name
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
     
    </div>
  );
};

ViewLink.craft = {
  related: {
    settings: ViewLinkSettings
  }
};
