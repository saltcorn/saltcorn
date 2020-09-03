import React, { useContext, Fragment } from "react";

import { Element, useNode } from "@craftjs/core";
import optionsCtx from "../context";

export const Column = ({ children, align }) => {
  const {
    connectors: { connect, drag },
  } = useNode();
  return (
    <div ref={(dom) => connect(drag(dom))}>
      <div className="canvas">{children}</div>
    </div>
  );
};

export const ColumnSettings = () => {
  const {} = useNode((node) => ({}));
  return <div></div>;
};
Column.craft = {
  displayName: "Column",
  props: {},
  rules: {
    canDrag: () => true,
  },
  related: {
    settings: ColumnSettings,
  },
};
