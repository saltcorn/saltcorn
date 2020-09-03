import React, { Fragment } from "react";
import { Element } from "@craftjs/core";
import { Text } from "./elements/Text";
import { Field } from "./elements/Field";
import { Empty } from "./elements/Empty";
import { TwoSplit, ntimes, sum } from "./elements/TwoSplit";
import { JoinField } from "./elements/JoinField";
import { Aggregation } from "./elements/Aggregation";
import { LineBreak } from "./elements/LineBreak";
import { ViewLink } from "./elements/ViewLink";
import { Action } from "./elements/Action";
import { HTMLCode } from "./elements/HTMLCode";
import { Card } from "./elements/Card";
import { Image } from "./elements/Image";
import { Link } from "./elements/Link";
import { View } from "./elements/View";
import { SearchBar } from "./elements/SearchBar";
import { Container } from "./elements/Container";

const getColWidths = (segment) => {
  if (!segment.widths)
    return ntimes(
      segment.besides.length - 1,
      () => 12 / segment.besides.length
    );

  var widths = [...segment.widths];
  widths.pop();
  return widths;
};

export const layoutToNodes = (layout, query, actions) => {
  //console.log("layoutToNodes", JSON.stringify(layout));
  function toTag(segment, ix) {
    if (!segment) return <Empty key={ix} />;
    if (segment.type === "blank" && segment.isHTML) {
      return <HTMLCode text={segment.contents} />;
    } else if (segment.type === "blank") {
      return (
        <Text
          key={ix}
          text={segment.contents}
          block={segment.block || false}
          textStyle={segment.textStyle || ""}
        />
      );
    } else if (segment.type === "image") {
      return (
        <Image
          key={ix}
          alt={segment.alt}
          block={segment.block || false}
          fileid={segment.fileid || 0}
        />
      );
    } else if (segment.type === "link") {
      return (
        <Link
          key={ix}
          url={segment.url}
          text={segment.text}
          block={segment.block || false}
          textStyle={segment.textStyle || ""}
        />
      );
    } else if (segment.type === "view") {
      return (
        <View
          key={ix}
          view={segment.view}
          name={segment.name}
          state={segment.state}
        />
      );
    } else if (segment.type === "line_break") {
      return <LineBreak key={ix} />;
    } else if (segment.type === "search_bar") {
      return <SearchBar key={ix} />;
    } else if (segment.type === "field") {
      return (
        <Field
          key={ix}
          name={segment.field_name}
          fieldview={segment.fieldview}
          block={segment.block || false}
          textStyle={segment.textStyle || ""}
        />
      );
    } else if (segment.type === "join_field") {
      return (
        <JoinField
          key={ix}
          name={segment.join_field}
          block={segment.block || false}
          textStyle={segment.textStyle || ""}
        />
      );
    } else if (segment.type === "aggregation") {
      return (
        <Aggregation
          key={ix}
          agg_relation={segment.agg_relation}
          agg_field={segment.agg_field}
          stat={segment.stat}
          block={segment.block || false}
          textStyle={segment.textStyle || ""}
        />
      );
    } else if (segment.type === "view_link") {
      return (
        <ViewLink
          key={ix}
          name={segment.view}
          label={segment.view_label}
          block={segment.block || false}
          minRole={segment.minRole || 10}
        />
      );
    } else if (segment.type === "action") {
      return (
        <Action
          key={ix}
          name={segment.action_name}
          block={segment.block || false}
          minRole={segment.minRole || 10}
        />
      );
    } else if (segment.type === "card") {
      return (
        <Card
          key={ix}
          contents={toTag(segment.contents)}
          title={segment.title}
        />
      );
    } else if (segment.type === "container") {
      return (
        <Element
          key={ix}
          canvas
          borderWidth={segment.borderWidth}
          borderStyle={segment.borderStyle}
          minHeight={segment.minHeight}
          vAlign={segment.vAlign}
          hAlign={segment.hAlign}
          bgFileId={segment.bgFileId}
          imageSize={segment.imageSize || "contain"}
          bgType={segment.bgType || "None"}
          bgColor={segment.bgColor || "#ffffff"}
          setTextColor={!!segment.setTextColor}
          textColor={segment.textColor || "#000000"}
          is={Container}
        >
          {toTag(segment.contents)}
        </Element>
      );
    } else if (segment.besides) {
      return (
        <TwoSplit
          key={ix}
          ncols={segment.besides.length}
          aligns={segment.aligns || segment.besides.map(() => "left")}
          widths={getColWidths(segment)}
          contents={segment.besides.map(toTag)}
        />
      );
    } else if (segment.above) {
      return segment.above.map((e, ix) => toTag(e, ix));
    }
  }
  function go(segment, parent) {
    if (!segment) return;
    if (segment.above) {
      segment.above.forEach((child) => {
        if (child) go(child, parent);
      });
    } else if (segment.besides) {
      const node = query
        .parseReactElement(
          <TwoSplit
            widths={getColWidths(segment)}
            ncols={segment.besides.length}
            aligns={segment.aligns || segment.besides.map(() => "left")}
            contents={segment.besides.map(toTag)}
          />
        )
        .toNodeTree();
      actions.addNodeTree(node, parent);
    } else {
      const tag = toTag(segment);
      if (tag) {
        const node = query.parseReactElement(tag).toNodeTree();
        //console.log("other", node);
        actions.addNodeTree(node, parent);
      }
    }
  }
  //const node1 = query.createNode(toTag(layout));
  //actions.add(node1, );
  go(layout, "ROOT");
};

const rand_ident = () => Math.floor(Math.random() * 16777215).toString(16);

export const craftToSaltcorn = (nodes) => {
  //console.log(JSON.stringify(nodes, null, 2));
  var columns = [];
  const get_nodes = (node) => {
    if (!node.nodes || node.nodes.length == 0) return;
    else if (node.nodes.length == 1) return go(nodes[node.nodes[0]]);
    else return { above: node.nodes.map((nm) => go(nodes[nm])) };
  };
  const go = (node) => {
    if (node.isCanvas) {
      if (node.displayName === Container.name)
        return {
          contents: get_nodes(node),
          type: "container",
          borderWidth: node.props.borderWidth,
          borderStyle: node.props.borderStyle,
          minHeight: node.props.minHeight,
          vAlign: node.props.vAlign,
          hAlign: node.props.hAlign,
          bgFileId: node.props.bgFileId,
          bgType: node.props.bgType,
          imageSize: node.props.imageSize,
          bgColor: node.props.bgColor,
          setTextColor: node.props.setTextColor,
          textColor: node.props.textColor,
        };
      else return get_nodes(node);
    }

    if (node.displayName === Text.name) {
      return {
        type: "blank",
        contents: node.props.text,
        block: node.props.block,
        textStyle: node.props.textStyle,
      };
    }
    if (node.displayName === HTMLCode.name) {
      return {
        type: "blank",
        isHTML: true,
        contents: node.props.text,
      };
    }
    if (node.displayName === LineBreak.name) {
      return { type: "line_break" };
    }
    if (node.displayName === SearchBar.name) {
      return { type: "search_bar" };
    }
    if (node.displayName === TwoSplit.name) {
      const widths = [...node.props.widths, 12 - sum(node.props.widths)];
      return {
        besides: widths.map((w, ix) => go(nodes[node.linkedNodes["Col" + ix]])),
        aligns: node.props.aligns,
        widths,
      };
    }
    if (node.displayName === Card.name) {
      return {
        contents: go(nodes[node.linkedNodes.cardContents]),
        type: "card",
        title: node.props.title,
      };
    }

    if (node.displayName === Image.name) {
      return {
        type: "image",
        alt: node.props.alt,
        fileid: node.props.fileid,
        block: node.props.block,
      };
    }
    if (node.displayName === Link.name) {
      return {
        type: "link",
        text: node.props.text,
        url: node.props.url,
        block: node.props.block,
        textStyle: node.props.textStyle,
      };
    }
    if (node.displayName === View.name) {
      return {
        type: "view",
        view: node.props.view,
        name:
          node.props.name === "not_assigned" ? rand_ident() : node.props.name,
        state: node.props.state,
      };
    }
    if (node.displayName === Field.name) {
      columns.push({
        type: "Field",
        field_name: node.props.name,
        fieldview: node.props.fieldview,
      });
      return {
        type: "field",
        block: node.props.block,
        field_name: node.props.name,
        fieldview: node.props.fieldview,
        textStyle: node.props.textStyle,
      };
    }
    if (node.displayName === JoinField.name) {
      columns.push({
        type: "JoinField",
        join_field: node.props.name,
      });
      return {
        type: "join_field",
        block: node.props.block,
        join_field: node.props.name,
        textStyle: node.props.textStyle,
      };
    }
    if (node.displayName === Aggregation.name) {
      columns.push({
        type: "Aggregation",
        agg_relation: node.props.agg_relation,
        agg_field: node.props.agg_field,
        stat: node.props.stat,
      });
      return {
        type: "aggregation",
        block: node.props.block,
        agg_relation: node.props.agg_relation,
        agg_field: node.props.agg_field,
        stat: node.props.stat,
        textStyle: node.props.textStyle,
      };
    }
    if (node.displayName === ViewLink.name) {
      columns.push({
        type: "ViewLink",
        view: node.props.name,
        minRole: node.props.minRole,
      });
      return {
        type: "view_link",
        block: node.props.block,
        view_label: node.props.label,
        view: node.props.name,
        minRole: node.props.minRole,
      };
    }
    if (node.displayName === Action.name) {
      columns.push({
        type: "Action",
        action_name: node.props.name,
        minRole: node.props.minRole,
      });
      return {
        type: "action",
        block: node.props.block,
        action_name: node.props.name,
        minRole: node.props.minRole,
      };
    }
  };
  const layout = go(nodes["ROOT"]) || { type: "blank", contents: "" };
  /*console.log("nodes", JSON.stringify(nodes));
  console.log("cols", JSON.stringify(columns));
  console.log("layout", JSON.stringify(layout));*/
  return { columns, layout };
};
