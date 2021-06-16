import React, { Fragment } from "react";
import { useNode } from "@craftjs/core";
import { SettingsFromFields } from "./utils";

export const LineBreak = ({}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <Fragment>
      <span
        className={selected ? "selected-node" : ""}
        ref={(dom) => connect(drag(dom))}
      >
        ↵
      </span>
      <br />
    </Fragment>
  );
};

LineBreak.craft = {
  displayName: "LineBreak",
  related: {
    settings: SettingsFromFields([]),
    segment_type: "line_break",
    fields: [],
  },
};
