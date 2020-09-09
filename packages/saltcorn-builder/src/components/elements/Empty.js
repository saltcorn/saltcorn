import React, { Fragment } from "react";
import { useNode } from "@craftjs/core";

export const Empty = ({}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <Fragment>
      <span ref={(dom) => connect(drag(dom))}></span>
    </Fragment>
  );
};
Empty.craft = {
  displayName: "Empty",
};
