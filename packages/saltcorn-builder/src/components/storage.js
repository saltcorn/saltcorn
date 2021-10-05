import React, { Fragment } from "react";
import { Element } from "@craftjs/core";
import { Text } from "./elements/Text";
import { Field } from "./elements/Field";
import { Empty } from "./elements/Empty";
import { Columns, ntimes, sum } from "./elements/Columns";
import { JoinField } from "./elements/JoinField";
import { Tabs } from "./elements/Tabs";
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
import { DropDownFilter } from "./elements/DropDownFilter";
import { ToggleFilter } from "./elements/ToggleFilter";

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
const default_breakpoints = (segment) =>
  ntimes(segment.besides.length, () => segment.breakpoint || "");

const allElements = [
  Text,
  Empty,
  Columns,
  JoinField,
  Field,
  ViewLink,
  Action,
  HTMLCode,
  LineBreak,
  Aggregation,
  Card,
  Image,
  Link,
  View,
  SearchBar,
  Container,
  DropDownFilter,
  Tabs,
  ToggleFilter,
];

export const layoutToNodes = (layout, query, actions, parent = "ROOT") => {
  //console.log("layoutToNodes", JSON.stringify(layout));
  function toTag(segment, ix) {
    if (!segment) return <Empty key={ix} />;

    const MatchElement = allElements.find(
      (e) =>
        e.craft.related &&
        e.craft.related.fields &&
        e.craft.related.segment_type &&
        e.craft.related.segment_type == segment.type &&
        (!e.craft.related.segment_match ||
          e.craft.related.segment_match(segment))
    );
    if (MatchElement) {
      const related = MatchElement.craft.related;
      const props = {};
      related.fields.forEach((f) => {
        const v = segment[f.segment_name || f.name || f];
        props[f.name || f] = typeof v === "undefined" ? f.default : v;
      });
      if (related.fields.some((f) => f.canBeFormula))
        props.isFormula = segment.isFormula;
      if (related.hasContents)
        return (
          <Element key={ix} canvas {...props} is={MatchElement}>
            {toTag(segment.contents)}
          </Element>
        );
      else return <MatchElement key={ix} {...props} />;
    }

    if (segment.type === "blank") {
      return (
        <Text
          key={ix}
          text={segment.contents}
          isFormula={segment.isFormula || {}}
          block={segment.block || false}
          textStyle={segment.textStyle || ""}
          labelFor={segment.labelFor || ""}
          icon={segment.icon}
          font={segment.font || ""}
        />
      );
    } else if (segment.type === "view") {
      return (
        <View
          key={ix}
          view={segment.view}
          name={segment.name}
          state={segment.state}
          configuration={segment.configuration || {}}
        />
      );
    } else if (segment.type === "action") {
      return (
        <Action
          key={ix}
          name={segment.action_name}
          rndid={segment.rndid || "not_assigned"}
          action_label={segment.action_label || ""}
          action_style={segment.action_style || "btn-primary"}
          action_size={segment.action_size || ""}
          action_icon={segment.action_icon || ""}
          action_bgcol={segment.action_bgcol || ""}
          action_bordercol={segment.action_bordercol || ""}
          action_textcol={segment.action_textcol || ""}
          confirm={segment.confirm}
          configuration={segment.configuration || {}}
          block={segment.block || false}
          minRole={segment.minRole || 10}
          isFormula={segment.isFormula || {}}
        />
      );
    } else if (segment.type === "container") {
      return (
        <Element
          key={ix}
          canvas
          borderWidth={segment.borderWidth}
          borderStyle={segment.borderStyle}
          borderRadius={segment.borderRadius}
          borderDirection={segment.borderDirection}
          borderColor={segment.borderColor}
          borderRadiusUnit={segment.borderRadiusUnit}
          gradStartColor={segment.gradStartColor}
          gradEndColor={segment.gradEndColor}
          gradDirection={segment.gradDirection}
          rotate={segment.rotate || 0}
          customClass={segment.customClass}
          customCSS={segment.customCSS}
          overflow={segment.overflow}
          margin={segment.margin || [0, 0, 0, 0]}
          padding={segment.padding || [0, 0, 0, 0]}
          minHeight={segment.minHeight}
          height={segment.height}
          width={segment.width}
          url={segment.url}
          hoverColor={segment.hoverColor}
          minHeightUnit={segment.minHeightUnit || "px"}
          heightUnit={segment.heightUnit || "px"}
          widthUnit={segment.widthUnit || "px"}
          vAlign={segment.vAlign}
          hAlign={segment.hAlign}
          display={
            segment.display ||
            (segment.block === true
              ? "block"
              : segment.block === false
              ? "inline-block"
              : "block")
          }
          fullPageWidth={
            typeof segment.fullPageWidth === "undefined"
              ? false
              : segment.fullPageWidth
          }
          flex_grow={segment.flex_grow}
          flex_shrink={segment.flex_shrink}
          flex_direction={segment.flex_direction}
          flex_wrap={segment.flex_wrap}
          justify_content={segment.justify_content}
          align_items={segment.align_items}
          align_content={segment.align_content}
          bgFileId={segment.bgFileId}
          imageSize={segment.imageSize || "contain"}
          bgType={segment.bgType || "None"}
          bgColor={segment.bgColor || "#ffffff"}
          setTextColor={!!segment.setTextColor}
          textColor={segment.textColor || "#000000"}
          isFormula={segment.isFormula || {}}
          showIfFormula={segment.showIfFormula || ""}
          showForRole={segment.showForRole || []}
          minScreenWidth={segment.minScreenWidth || ""}
          maxScreenWidth={segment.maxScreenWidth || ""}
          show_for_owner={!!segment.show_for_owner}
          is={Container}
        >
          {toTag(segment.contents)}
        </Element>
      );
    } else if (segment.type === "tabs") {
      return (
        <Tabs
          key={ix}
          titles={segment.titles}
          ntabs={segment.ntabs}
          tabsStyle={segment.tabsStyle}
          contents={segment.contents.map(toTag)}
        />
      );
    } else if (segment.besides) {
      return (
        <Columns
          key={ix}
          breakpoints={segment.breakpoints || default_breakpoints(segment)}
          ncols={segment.besides.length}
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
          <Columns
            widths={getColWidths(segment)}
            breakpoints={segment.breakpoints || default_breakpoints(segment)}
            ncols={segment.besides.length}
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
  go(layout, parent);
};

const rand_ident = () => Math.floor(Math.random() * 16777215).toString(16);

export const craftToSaltcorn = (nodes, startFrom = "ROOT") => {
  //console.log(JSON.stringify(nodes, null, 2));
  var columns = [];
  const get_nodes = (node) => {
    if (!node.nodes || node.nodes.length == 0) return;
    else if (node.nodes.length == 1) return go(nodes[node.nodes[0]]);
    else return { above: node.nodes.map((nm) => go(nodes[nm])) };
  };
  const go = (node) => {
    const matchElement = allElements.find(
      (e) =>
        e.craft.related &&
        node.displayName === e.craft.displayName &&
        e.craft.related.fields &&
        e.craft.related.segment_type
    );
    if (matchElement) {
      const related = matchElement.craft.related;
      const s = { type: related.segment_type };
      if (related.hasContents) s.contents = get_nodes(node);
      related.fields.forEach((f) => {
        s[f.segment_name || f.name || f] = node.props[f.name || f];
      });
      if (related.fields.some((f) => f.canBeFormula))
        s.isFormula = node.props.isFormula;
      if (related.segment_vars) Object.assign(s, related.segment_vars);
      if (related.column_type) {
        const c = { type: related.column_type };
        related.fields.forEach((f) => {
          c[f.column_name || f.name || f] = node.props[f.name || f];
        });
        columns.push(c);
      }
      return s;
    }
    if (node.isCanvas) {
      if (node.displayName === Container.craft.displayName)
        return {
          contents: get_nodes(node),
          type: "container",
          borderWidth: node.props.borderWidth,
          borderStyle: node.props.borderStyle,
          borderColor: node.props.borderColor,
          borderRadius: node.props.borderRadius,
          borderDirection: node.props.borderDirection,
          borderRadiusUnit: node.props.borderRadiusUnit,
          customCSS: node.props.customCSS,
          customClass: node.props.customClass,
          minHeight: node.props.minHeight,
          height: node.props.height,
          width: node.props.width,
          url: node.props.url,
          hoverColor: node.props.hoverColor,
          minHeightUnit: node.props.minHeightUnit,
          heightUnit: node.props.heightUnit,
          widthUnit: node.props.widthUnit,
          vAlign: node.props.vAlign,
          hAlign: node.props.hAlign,
          margin: node.props.margin,
          padding: node.props.padding,
          overflow: node.props.overflow,
          display: node.props.display,
          fullPageWidth: node.props.fullPageWidth || false,
          bgFileId: node.props.bgFileId,
          bgType: node.props.bgType,
          imageSize: node.props.imageSize,
          bgColor: node.props.bgColor,
          setTextColor: node.props.setTextColor,
          textColor: node.props.textColor,
          isFormula: node.props.isFormula,
          showIfFormula: node.props.showIfFormula,
          showForRole: node.props.showForRole,
          minScreenWidth: node.props.minScreenWidth,
          maxScreenWidth: node.props.maxScreenWidth,
          show_for_owner: node.props.show_for_owner,
          gradStartColor: node.props.gradStartColor,
          gradEndColor: node.props.gradEndColor,
          gradDirection: node.props.gradDirection,
          rotate: node.props.rotate,
          flex_grow: node.props.flex_grow,
          flex_shrink: node.props.flex_shrink,
          flex_direction: node.props.flex_direction,
          flex_wrap: node.props.flex_wrap,
          justify_content: node.props.justify_content,
          align_items: node.props.align_items,
          align_content: node.props.align_content,
        };
      else return get_nodes(node);
    }

    if (node.displayName === Text.craft.displayName) {
      return {
        type: "blank",
        contents: node.props.text,
        block: node.props.block,
        textStyle: node.props.textStyle,
        isFormula: node.props.isFormula,
        labelFor: node.props.labelFor,
        icon: node.props.icon,
        font: node.props.font,
      };
    }

    if (node.displayName === Columns.craft.displayName) {
      const widths = [...node.props.widths, 12 - sum(node.props.widths)];
      return {
        besides: widths.map((w, ix) => go(nodes[node.linkedNodes["Col" + ix]])),
        breakpoints: node.props.breakpoints,
        widths,
      };
    }
    if (node.displayName === Tabs.craft.displayName) {
      return {
        type: "tabs",
        contents: ntimes(node.props.ntabs, (ix) =>
          go(nodes[node.linkedNodes["Tab" + ix]])
        ),
        titles: node.props.titles,
        tabsStyle: node.props.tabsStyle,
        ntabs: node.props.ntabs,
      };
    }

    if (node.displayName === View.craft.displayName) {
      return {
        type: "view",
        view: node.props.view,
        name:
          node.props.name === "not_assigned" ? rand_ident() : node.props.name,
        state: node.props.state,
        configuration: node.props.configuration,
      };
    }

    if (node.displayName === Action.craft.displayName) {
      const newid = rand_ident();
      columns.push({
        type: "Action",
        action_name: node.props.name,
        action_label: node.props.action_label,
        action_style: node.props.action_style,
        action_size: node.props.action_size,
        action_icon: node.props.action_icon,
        action_bgcol: node.props.action_bgcol,
        action_bordercol: node.props.action_bordercol,
        action_textcol: node.props.action_textcol,
        minRole: node.props.minRole,
        confirm: node.props.confirm,
        configuration: node.props.configuration,
        isFormula: node.props.isFormula,
        rndid: node.props.rndid === "not_assigned" ? newid : node.props.rndid,
      });
      return {
        type: "action",
        block: node.props.block,
        configuration: node.props.configuration,
        confirm: node.props.confirm,
        action_name: node.props.name,
        action_label: node.props.action_label,
        action_style: node.props.action_style,
        action_size: node.props.action_size,
        action_icon: node.props.action_icon,
        action_bgcol: node.props.action_bgcol,
        action_bordercol: node.props.action_bordercol,
        action_textcol: node.props.action_textcol,
        minRole: node.props.minRole,
        isFormula: node.props.isFormula,
        rndid: node.props.rndid === "not_assigned" ? newid : node.props.rndid,
      };
    }
  };
  const layout = go(nodes[startFrom]) || { type: "blank", contents: "" };
  /*console.log("nodes", JSON.stringify(nodes));
  console.log("cols", JSON.stringify(columns));
  console.log("layout", JSON.stringify(layout));*/
  return { columns, layout };
};
