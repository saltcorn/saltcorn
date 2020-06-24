import React, { Fragment } from "react";
import { Text } from "./Text";

import { Canvas, useNode } from "@craftjs/core";

export const Card = ({ contents, title }) => {
  const {
    connectors: { connect, drag }
  } = useNode();

  return (
    <div className="card builder" ref={dom => connect(drag(dom))}>
      {title && title.length > 0 && <div className="card-header">{title}</div>}
      <div className="card-body">
        <Canvas id={`cardContents`} is="div" className={`canvas`}>
          {contents}
        </Canvas>
      </div>
    </div>
  );
};

export const CardSettings = () => {
  const { setProp, title } = useNode(node => ({
    title: node.data.props.title
  }));
  return (
    <div>
      <label>Card title</label>
      <input
        type="text"
        value={title}
        onChange={e => setProp(prop => (prop.title = e.target.value))}
      />
    </div>
  );
};
Card.craft = {
  defaultProps: {
    title: ""
  },
  related: {
    settings: CardSettings
  }
};
