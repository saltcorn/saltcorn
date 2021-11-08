import React, { Fragment } from "react";
import { useNode } from "@craftjs/core";

export const Empty = ({}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return null;
};
Empty.craft = {
  displayName: "Empty",
};
