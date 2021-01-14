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
          isFormula={segment.isFormula || {}}
          block={segment.block || false}
          textStyle={segment.textStyle || ""}
          labelFor={segment.labelFor || ""}
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
          nofollow={segment.nofollow || false}
          target_blank={segment.target_blank || false}
          isFormula={segment.isFormula || {}}
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
          label={segment.label}
          block={segment.block || false}
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
          inModal={segment.in_modal || false}
          minRole={segment.minRole || 10}
          isFormula={segment.isFormula || {}}
          link_style={segment.link_style || ""}
          link_size={segment.link_size || ""}
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
          confirm={segment.confirm}
          configuration={segment.configuration || {}}
          block={segment.block || false}
          minRole={segment.minRole || 10}
          isFormula={segment.isFormula || {}}
        />
      );
    } else if (segment.type === "card") {
      return (
        <Element
          key={ix}
          canvas
          title={segment.title}
          url={segment.url}
          isFormula={segment.isFormula || {}}
          is={Card}
        >
          {toTag(segment.contents)}
        </Element>
      );
    } else if (segment.type === "container") {
      return (
        <Element
          key={ix}
          canvas
          borderWidth={segment.borderWidth}
          borderStyle={segment.borderStyle}
          customClass={segment.customClass}
          customCSS={segment.customCSS}
          minHeight={segment.minHeight}
          height={segment.height}
          width={segment.width}
          widthPct={segment.widthPct}
          vAlign={segment.vAlign}
          hAlign={segment.hAlign}
          block={typeof segment.block === "undefined" ? true : segment.block}
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
          breakpoint={segment.breakpoint || ""}
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
            breakpoint={segment.breakpoint || ""}
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
    if (node.isCanvas) {
      if (node.displayName === Container.craft.displayName)
        return {
          contents: get_nodes(node),
          type: "container",
          borderWidth: node.props.borderWidth,
          borderStyle: node.props.borderStyle,
          customCSS: node.props.customCSS,
          customClass: node.props.customClass,
          minHeight: node.props.minHeight,
          height: node.props.height,
          width: node.props.width,
          widthPct: node.props.widthPct,
          vAlign: node.props.vAlign,
          hAlign: node.props.hAlign,
          block: node.props.block || false,
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
        };
      else if (node.displayName === Card.craft.displayName)
        return {
          contents: get_nodes(node),
          type: "card",
          title: node.props.title,
          isFormula: node.props.isFormula,
          url: node.props.url,
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
      };
    }
    if (node.displayName === HTMLCode.craft.displayName) {
      return {
        type: "blank",
        isHTML: true,
        contents: node.props.text,
      };
    }
    if (node.displayName === LineBreak.craft.displayName) {
      return { type: "line_break" };
    }
    if (node.displayName === SearchBar.craft.displayName) {
      return {
        type: "search_bar",
        has_dropdown: node.props.has_dropdown,
        show_badges: node.props.show_badges,
        contents: go(nodes[node.linkedNodes["search_drop"]]),
      };
    }
    if (node.displayName === Columns.craft.displayName) {
      const widths = [...node.props.widths, 12 - sum(node.props.widths)];
      return {
        besides: widths.map((w, ix) => go(nodes[node.linkedNodes["Col" + ix]])),
        breakpoint: node.props.breakpoint,
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

    if (node.displayName === Image.craft.displayName) {
      return {
        type: "image",
        alt: node.props.alt,
        fileid: node.props.fileid,
        block: node.props.block,
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
      });
      return {
        type: "toggle_filter",
        block: node.props.block,
        field_name: node.props.name,
        value: node.props.value,
        label: node.props.label,
      };
    }
    if (node.displayName === JoinField.craft.displayName) {
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
    if (node.displayName === Aggregation.craft.displayName) {
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
        link_size: node.props.link_size,
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
