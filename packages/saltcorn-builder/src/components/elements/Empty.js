import React, { Fragment } from "react";
import { useNode } from "@craftjs/core";

export const Empty = ({}) => {
  const {
    connectors: { connect, drag },
  } = useNode();
  return (
    <Fragment>
      <span ref={(dom) => connect(drag(dom))}></span>
    </Fragment>
  );
};
