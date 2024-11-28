import React, { Fragment, useState, useEffect } from "react";
import { ListColumn } from "./ListColumn";
import { Columns, ntimes } from "./Columns";
import { rand_ident } from "./utils";
import { Element } from "@craftjs/core";

export const recursivelyCloneToElems = (query) => (nodeId, ix) => {
  const { data } = query.node(nodeId).get();
  const { type, props, nodes } = data;
  const newProps = { ...props };
  if (newProps.rndid) {
    newProps.rndid = rand_ident();
  }

  // console.log("cloning", data.displayName, data.linkedNodes["listcol"]);

  const children = (nodes || []).map(recursivelyCloneToElems(query));
  if (data.displayName === "Columns") {
    const cols = ntimes(data.props.ncols, (ix) =>
      recursivelyCloneToElems(query)(data.linkedNodes["Col" + ix])
    );
    return React.createElement(Columns, {
      ...newProps,
      ...(typeof ix !== "undefined" ? { key: ix } : {}),
      contents: cols,
    });
  }

  if (data.displayName === "ListColumn") {
    const col = recursivelyCloneToElems(query)(data.linkedNodes["listcol"]);

    return React.createElement(ListColumn, {
      ...newProps,
      contents: col,
    });
  }

  if (data.isCanvas)
    return React.createElement(
      Element,
      {
        ...newProps,
        canvas: true,
        is: type,
        ...(typeof ix !== "undefined" ? { key: ix } : {}),
      },
      children
    );
  return React.createElement(
    type,
    {
      ...newProps,
      ...(typeof ix !== "undefined" ? { key: ix } : {}),
    },
    children
  );
};
