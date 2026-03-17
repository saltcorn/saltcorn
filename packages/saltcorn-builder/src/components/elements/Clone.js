import React, { Fragment, useState, useEffect } from "react";
import { ListColumn } from "./ListColumn";
import { Columns, ntimes } from "./Columns";
import { Card } from "./Card";
import { Container } from "./Container";
import { Tabs } from "./Tabs";
import { Table } from "./Table";
import { Element } from "@craftjs/core";

const rand_ident = () =>
  Math.floor(Math.random() * 16777215).toString(16);

/**
 * Clone the children of a linked node (not the linked node wrapper itself).
 * The parent component's render recreates the wrapper via <Element canvas>.
 */
const cloneLinkedNodeChildren = (query, linkedNodeId) => {
  if (!linkedNodeId) return undefined;
  const linkedNodeData = query.node(linkedNodeId).get().data;
  const childNodes = linkedNodeData.nodes || [];
  return childNodes.map(recursivelyCloneToElems(query));
};

export const recursivelyCloneToElems = (query) => (nodeId, ix) => {
  const { data } = query.node(nodeId).get();
  const { type, props, nodes } = data;
  const newProps = { ...props };
  if (newProps.rndid) {
    newProps.rndid = rand_ident();
  }

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

  if (data.displayName === "Card") {
    const clonedContents = cloneLinkedNodeChildren(
      query,
      data.linkedNodes["cardbody"]
    );
    const clonedFooter = cloneLinkedNodeChildren(
      query,
      data.linkedNodes["cardfooter"]
    );
    return React.createElement(Card, {
      ...newProps,
      ...(typeof ix !== "undefined" ? { key: ix } : {}),
      contents: clonedContents,
      footer: clonedFooter,
    });
  }

  if (data.displayName === "Container") {
    const clonedContents = cloneLinkedNodeChildren(
      query,
      data.linkedNodes["container-canvas"]
    );
    return React.createElement(Container, {
      ...newProps,
      ...(typeof ix !== "undefined" ? { key: ix } : {}),
      contents: clonedContents,
    });
  }

  if (data.displayName === "Tabs") {
    const cols = ntimes(data.props.ntabs, (ix) =>
      data.linkedNodes["Tab" + ix]
        ? cloneLinkedNodeChildren(query, data.linkedNodes["Tab" + ix])
        : undefined
    );
    return React.createElement(Tabs, {
      ...newProps,
      ...(typeof ix !== "undefined" ? { key: ix } : {}),
      contents: cols,
    });
  }

  if (data.displayName === "Table") {
    const rows = data.props.rows || 0;
    const columns = data.props.columns || 0;
    const clonedContents = ntimes(rows, (ri) =>
      ntimes(columns, (ci) =>
        data.linkedNodes[`cell_${ri}_${ci}`]
          ? cloneLinkedNodeChildren(query, data.linkedNodes[`cell_${ri}_${ci}`])
          : undefined
      )
    );
    return React.createElement(Table, {
      ...newProps,
      ...(typeof ix !== "undefined" ? { key: ix } : {}),
      contents: clonedContents,
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
