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

export const layoutToNodes = (layout, query, actions) => {
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

    if (segment.type === "blank" && segment.isHTML) {
      return <HTMLCode text={segment.contents} />;
    } else if (segment.type === "blank") {
      return (
        <Text
          key={ix}
          text={segment.contents}
          isFormula={segment.isFormula || {}}
          block={segment.block || false}
          textStyle={segment.textStyle || ""}
          labelFor={segment.labelFor || ""}
          icon={segment.icon}
        />
      );
    } else if (segment.type === "link") {
      return (
        <Link
          key={ix}
          url={segment.url}
          text={segment.text}
          block={segment.block || false}
          nofollow={segment.nofollow || false}
          target_blank={segment.target_blank || false}
          isFormula={segment.isFormula || {}}
          textStyle={segment.textStyle || ""}
          link_src={segment.link_src || "URL"}
          link_style={segment.link_style || ""}
          link_icon={segment.link_icon || ""}
          link_size={segment.link_size || ""}
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
    } else if (segment.type === "search_bar") {
      return (
        <SearchBar
          key={ix}
          contents={toTag(segment.contents)}
          has_dropdown={segment.has_dropdown || false}
          show_badges={segment.show_badges || false}
        />
      );
    } else if (segment.type === "field") {
      return (
        <Field
          key={ix}
          name={segment.field_name}
          fieldview={segment.fieldview}
          block={segment.block || false}
          textStyle={segment.textStyle || ""}
          configuration={segment.configuration || {}}
        />
      );
    } else if (segment.type === "dropdown_filter") {
      return (
        <DropDownFilter
          key={ix}
          name={segment.field_name}
          neutral_label={segment.neutral_label || ""}
          block={segment.block || false}
          full_width={segment.full_width || false}
        />
      );
    } else if (segment.type === "toggle_filter") {
      return (
        <ToggleFilter
          key={ix}
          name={segment.field_name}
          value={segment.value}
          preset_value={segment.preset_value}
          label={segment.label}
          size={segment.size}
          style={segment.style}
          block={segment.block || false}
        />
      );
    } else if (segment.type === "join_field") {
      return (
        <JoinField
          key={ix}
          name={segment.join_field}
          block={segment.block || false}
          fieldview={segment.fieldview}
          textStyle={segment.textStyle || ""}
        />
      );
    } else if (segment.type === "aggregation") {
      return (
        <Aggregation
          key={ix}
          agg_relation={segment.agg_relation}
          agg_field={segment.agg_field}
          aggwhere={segment.aggwhere || ""}
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
          inModal={segment.in_modal || false}
          minRole={segment.minRole || 10}
          isFormula={segment.isFormula || {}}
          link_style={segment.link_style || ""}
          link_icon={segment.link_icon || ""}
          link_size={segment.link_size || ""}
          textStyle={segment.textStyle || ""}
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
          block={typeof segment.block === "undefined" ? true : segment.block}
          fullPageWidth={
            typeof segment.fullPageWidth === "undefined"
              ? false
              : segment.fullPageWidth
          }
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
          block: node.props.block || false,
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
      };
    }
    if (node.displayName === HTMLCode.craft.displayName) {
      return {
        type: "blank",
        isHTML: true,
        contents: node.props.text,
      };
    }
    if (node.displayName === SearchBar.craft.displayName) {
      return {
        type: "search_bar",
        has_dropdown: node.props.has_dropdown,
        show_badges: node.props.show_badges,
        contents:
          node.linkedNodes &&
          node.props.has_dropdown &&
          go(nodes[node.linkedNodes["search_drop"]]),
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
    if (node.displayName === Link.craft.displayName) {
      return {
        type: "link",
        text: node.props.text,
        url: node.props.url,
        block: node.props.block,
        nofollow: node.props.nofollow,
        target_blank: node.props.target_blank,
        isFormula: node.props.isFormula,
        textStyle: node.props.textStyle,
        link_src: node.props.link_src,
        link_style: node.props.link_style,
        link_size: node.props.link_size,
        link_icon: node.props.link_icon,
      };
    }
    if (node.displayName === View.craft.displayName) {
      return {
        type: "view",
        view: node.props.view,
        name:
          node.props.name === "not_assigned" ? rand_ident() : node.props.name,
        state: node.props.state,
      };
    }
    if (node.displayName === Field.craft.displayName) {
      columns.push({
        type: "Field",
        field_name: node.props.name,
        fieldview: node.props.fieldview,
        configuration: node.props.configuration,
      });
      return {
        type: "field",
        block: node.props.block,
        field_name: node.props.name,
        fieldview: node.props.fieldview,
        textStyle: node.props.textStyle,
        configuration: node.props.configuration,
      };
    }
    if (node.displayName === DropDownFilter.craft.displayName) {
      columns.push({
        type: "DropDownFilter",
        field_name: node.props.name,
      });
      return {
        type: "dropdown_filter",
        block: node.props.block,
        neutral_label: node.props.neutral_label,
        full_width: node.props.full_width,
        field_name: node.props.name,
      };
    }
    if (node.displayName === ToggleFilter.craft.displayName) {
      columns.push({
        type: "ToggleFilter",
        field_name: node.props.name,
        value: node.props.value,
        preset_value: node.props.preset_value,
      });
      return {
        type: "toggle_filter",
        block: node.props.block,
        field_name: node.props.name,
        value: node.props.value,
        preset_value: node.props.preset_value,
        label: node.props.label,
        size: node.props.size,
        style: node.props.style,
      };
    }
    if (node.displayName === JoinField.craft.displayName) {
      columns.push({
        type: "JoinField",
        join_field: node.props.name,
        fieldview: node.props.fieldview,
      });
      return {
        type: "join_field",
        block: node.props.block,
        join_field: node.props.name,
        fieldview: node.props.fieldview,
        textStyle: node.props.textStyle,
      };
    }
    if (node.displayName === Aggregation.craft.displayName) {
      columns.push({
        type: "Aggregation",
        agg_relation: node.props.agg_relation,
        agg_field: node.props.agg_field,
        aggwhere: node.props.aggwhere,
        stat: node.props.stat,
      });
      return {
        type: "aggregation",
        block: node.props.block,
        agg_relation: node.props.agg_relation,
        agg_field: node.props.agg_field,
        aggwhere: node.props.aggwhere,
        stat: node.props.stat,
        textStyle: node.props.textStyle,
      };
    }
    if (node.displayName === ViewLink.craft.displayName) {
      columns.push({
        type: "ViewLink",
        view: node.props.name,
        in_modal: node.props.inModal,
        minRole: node.props.minRole,
      });
      return {
        type: "view_link",
        block: node.props.block,
        in_modal: node.props.inModal,
        view_label: node.props.label,
        view: node.props.name,
        isFormula: node.props.isFormula,
        minRole: node.props.minRole,
        link_style: node.props.link_style,
        link_icon: node.props.link_icon,
        link_size: node.props.link_size,
        textStyle: node.props.textStyle,
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
        minRole: node.props.minRole,
        isFormula: node.props.isFormula,
        rndid: node.props.rndid === "not_assigned" ? newid : node.props.rndid,
      };
    }
  };
  const layout = go(nodes["ROOT"]) || { type: "blank", contents: "" };
  /*console.log("nodes", JSON.stringify(nodes));
  console.log("cols", JSON.stringify(columns));
  console.log("layout", JSON.stringify(layout));*/
  return { columns, layout };
};
