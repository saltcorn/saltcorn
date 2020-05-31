import React, { Fragment } from "react";
import { useNode } from "@craftjs/core";

export const LineBreak = ({}) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return (
    <Fragment>
      <span ref={dom => connect(drag(dom))}>↵</span>
      <br />
    </Fragment>
  );
};
