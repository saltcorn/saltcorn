/**
 * @category saltcorn-builder
 * @module components/storage
 * @subcategory components
 */

import React, { Fragment } from "react";
import { Element } from "@craftjs/core";
import { Text } from "./elements/Text";
import { Field } from "./elements/Field";
import { Empty } from "./elements/Empty";
import { Columns, ntimes, sum } from "./elements/Columns";
import { JoinField } from "./elements/JoinField";
import { Tabs } from "./elements/Tabs";
import { ListColumns } from "./elements/ListColumns";
import { ListColumn } from "./elements/ListColumn";
import { Table } from "./elements/Table";
import { Aggregation } from "./elements/Aggregation";
import { LineBreak } from "./elements/LineBreak";
import { ViewLink } from "./elements/ViewLink";
import { Action } from "./elements/Action";
import { HTMLCode } from "./elements/HTMLCode";
import { Card } from "./elements/Card";
import { Image } from "./elements/Image";
import { Link } from "./elements/Link";
import { View } from "./elements/View";
import { Page } from "./elements/Page";
import { SearchBar } from "./elements/SearchBar";
import { Container } from "./elements/Container";
import { DropDownFilter } from "./elements/DropDownFilter";
import { ToggleFilter } from "./elements/ToggleFilter";
import { DropMenu } from "./elements/DropMenu";
import { rand_ident } from "./elements/utils";

/**
 * @param {object} segment
 * @returns {number}
 */
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

/**
 * @param {object} segment
 * @returns {object[]}
 */
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
  DropMenu,
  Page,
  Table,
  ListColumn,
  ListColumns,
];

export /**
 * @param {object} layout
 * @param {object} query
 * @param {object} actions
 * @param {string} [parent = "ROOT"]
 * @returns {Text|View|Action|Element|Tabs|Columns}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const layoutToNodes = (
  layout,
  query,
  actions,
  parent = "ROOT",
  options,
  index = false
) => {
  //console.log("layoutToNodes", JSON.stringify(layout));
  /**
   * @param {object} segment
   * @param {string} ix
   * @returns {Element|Text|View|Action|Tabs|Columns}
   */
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
        if (f.type === "Nodes" && f.nodeID) {
          props[f.name || f] = toTag(segment[f.segment_name || f.name || f]);
          //).map(toTag);
        } else {
          const v = segment[f.segment_name || f.name || f];
          props[f.name || f] = typeof v === "undefined" ? f.default : v;
        }
      });
      if (related.fields.some((f) => f.canBeFormula))
        props.isFormula = segment.isFormula;
      if (related.hasContents)
        return (
          <Element
            key={ix}
            canvas
            {...props}
            is={MatchElement}
            custom={segment._custom || {}}
          >
            {toTag(segment.contents)}
          </Element>
        );
      else
        return (
          <MatchElement key={ix} custom={segment._custom || {}} {...props} />
        );
    }
    if (segment.type === "blank") {
      return (
        <Text
          custom={segment._custom || {}}
          key={ix}
          text={segment.contents}
          isFormula={segment.isFormula || {}}
          block={segment.block || false}
          inline={segment.inline || false}
          textStyle={segment.textStyle || ""}
          labelFor={segment.labelFor || ""}
          customClass={segment.customClass || ""}
          style={segment.style || {}}
          icon={segment.icon}
          font={segment.font || ""}
        />
      );
    } else if (segment.type === "view") {
      return (
        <View
          custom={segment._custom || {}}
          key={ix}
          view={segment.view}
          relation={segment.relation}
          order_field={segment.order_field}
          view_name={segment.view_name}
          name={segment.name}
          state={segment.state}
          extra_state_fml={segment.extra_state_fml}
          configuration={segment.configuration || {}}
        />
      );
    } else if (segment.type === "action") {
      return (
        <Action
          custom={segment._custom || {}}
          key={ix}
          name={segment.action_name}
          rndid={segment.rndid || "not_assigned"}
          action_row_variable={segment.action_row_variable || ""}
          action_row_limit={segment.action_row_limit || ""}
          action_label={segment.action_label || ""}
          action_style={segment.action_style || "btn-primary"}
          action_size={segment.action_size || ""}
          action_icon={segment.action_icon || ""}
          action_title={segment.action_title || ""}
          action_class={segment.action_class || ""}
          action_bgcol={segment.action_bgcol || ""}
          action_bordercol={segment.action_bordercol || ""}
          action_textcol={segment.action_textcol || ""}
          nsteps={segment.nsteps || ""}
          step_only_ifs={segment.step_only_ifs || ""}
          step_action_names={segment.step_action_names || ""}
          confirm={segment.confirm}
          spinner={segment.spinner}
          is_submit_action={segment.is_submit_action}
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
          custom={segment._custom || {}}
          canvas
          gradStartColor={segment.gradStartColor}
          gradEndColor={segment.gradEndColor}
          gradDirection={segment.gradDirection}
          rotate={segment.rotate || 0}
          animateName={segment.animateName}
          animateDuration={segment.animateDuration}
          animateDelay={segment.animateDelay}
          animateInitialHide={segment.animateInitialHide}
          customClass={segment.customClass}
          customId={segment.customId}
          customCSS={segment.customCSS}
          overflow={segment.overflow}
          margin={segment.margin || [0, 0, 0, 0]}
          padding={segment.padding || [0, 0, 0, 0]}
          minHeight={segment.minHeight}
          height={segment.height}
          width={segment.width}
          click_action={segment.click_action}
          url={segment.url}
          hoverColor={segment.hoverColor}
          minHeightUnit={segment.minHeightUnit || "px"}
          heightUnit={segment.heightUnit || "px"}
          widthUnit={segment.widthUnit || "px"}
          vAlign={segment.vAlign}
          hAlign={segment.hAlign}
          htmlElement={segment.htmlElement || "div"}
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
          bgFileId={segment.bgFileId}
          bgField={segment.bgField}
          imageSize={segment.imageSize || "contain"}
          imgResponsiveWidths={segment.imgResponsiveWidths}
          bgType={segment.bgType || "None"}
          style={segment.style || {}}
          transform={segment.transform || {}}
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
      let contentsArray = segment.contents.map(toTag);
      let contents;
      if (segment.tabsStyle === "Value switch") {
        contents = {};
        segment.titles.forEach(({ label, value }, ix) => {
          contents[value] = contentsArray[ix];
        });
      } else contents = contentsArray;
      return (
        <Tabs
          key={ix}
          custom={segment._custom || {}}
          titles={segment.titles}
          showif={segment.showif}
          ntabs={segment.ntabs}
          setting_tab_n={segment.setting_tab_n}
          independent={segment.independent}
          startClosed={segment.startClosed}
          deeplink={segment.deeplink}
          acc_init_opens={segment.acc_init_opens}
          disable_inactive={segment.disable_inactive}
          serverRendered={segment.serverRendered}
          tabId={segment.tabId}
          field={segment.field}
          tabsStyle={segment.tabsStyle}
          contents={contents}
        />
      );
    } else if (segment.type === "table") {
      return (
        <Table
          key={ix}
          custom={segment._custom || {}}
          rows={segment.rows || 2}
          columns={segment.columns || 2}
          bs_style={segment.bs_style || false}
          bs_small={segment.bs_small || false}
          bs_striped={segment.bs_striped || false}
          bs_bordered={segment.bs_bordered || false}
          bs_wauto={segment.bs_wauto || false}
          bs_borderless={segment.bs_borderless || false}
          contents={(segment.contents || []).map((row) =>
            (row || []).map(toTag)
          )}
        />
      );
    } else if (segment.besides && segment.list_columns) {
      const addFields = options.additionalColumnFields;

      return segment.besides.map((col, jx) => {
        const addProps = {};
        (addFields || []).forEach((f) => {
          addProps[f.name] = col[f.name];
        });
        return (
          <ListColumn
            custom={segment._custom || {}}
            key={jx}
            alignment={col.alignment}
            header_label={col.header_label}
            col_width={col.col_width}
            showif={col.showif}
            col_width_units={col.col_width_units}
            contents={toTag(col.contents)}
            {...addProps}
          ></ListColumn>
        );
      });
    } else if (segment.besides) {
      return (
        <Columns
          key={ix}
          custom={segment._custom || {}}
          breakpoints={segment.breakpoints || default_breakpoints(segment)}
          ncols={segment.besides.length}
          widths={getColWidths(segment)}
          style={segment.style || {}}
          gx={segment.gx}
          gy={segment.gy}
          vAligns={segment.vAligns}
          colClasses={segment.colClasses}
          colStyles={segment.colStyles}
          aligns={segment.aligns}
          setting_col_n={1}
          contents={segment.besides.map(toTag)}
        />
      );
    } else if (segment.above) {
      return segment.above.map((e, ix) => toTag(e, ix));
    }
  }

  /**
   * @param {object} segment
   * @param {object} parent
   * @returns {void}
   */
  function go(segment, parent, ix0) {
    const ix = typeof ix0 === "number" ? ix0 : undefined;
    if (!segment) return;
    if (segment.above) {
      segment.above.forEach((child) => {
        if (child) go(child, parent);
      });
    } else if (segment.besides && !segment.list_columns) {
      const node = query
        .parseReactElement(
          <Columns
            widths={getColWidths(segment)}
            breakpoints={segment.breakpoints || default_breakpoints(segment)}
            ncols={segment.besides.length}
            style={segment.style || {}}
            gx={segment.gx}
            gy={segment.gy}
            vAligns={segment.vAligns}
            colClasses={segment.colClasses}
            colStyles={segment.colStyles}
            aligns={segment.aligns}
            setting_col_n={1}
            contents={segment.besides.map(toTag)}
          />
        )
        .toNodeTree();
      actions.addNodeTree(node, parent, ix);
    } else {
      const tag = toTag(segment);
      if (Array.isArray(tag)) {
        tag.forEach((t) => {
          const node = query.parseReactElement(t).toNodeTree();
          //console.log("other", node);
          actions.addNodeTree(node, parent, ix);
        });
      } else if (tag) {
        const node = query.parseReactElement(tag).toNodeTree();
        //console.log("other", node);
        actions.addNodeTree(node, parent, ix);
      }
    }
  }
  //const node1 = query.createNode(toTag(layout));
  //actions.add(node1, );
  go(layout, parent, index);
};

/**
 * @returns {number}
 */

export /**
 * @param {object[]} nodes
 * @param {string} [startFrom = "ROOT" ]
 * @returns {object}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const craftToSaltcorn = (nodes, startFrom = "ROOT", options) => {
  //console.log(JSON.stringify(nodes, null, 2));
  var columns = [];
  /**
   * @param {object} node
   * @returns {void|object}
   */
  const removeEmpty = ({ above }) => {
    const valids = above.filter(Boolean);
    if (valids.length === 1) return valids[0];
    else return { above: valids };
  };

  const get_nodes = (node) => {
    if (!node.nodes || node.nodes.length == 0) return;
    else if (node.nodes.length == 1) return go(nodes[node.nodes[0]]);
    else return removeEmpty({ above: node.nodes.map((nm) => go(nodes[nm])) });
  };

  /**
   * @param {object} node
   * @returns {object}
   */
  const go = (node) => {
    if (!node) return;
    let customProps = {};
    if (Object.keys(node?.custom || {}).length)
      customProps = { _custom: { ...node?.custom } };
    const matchElement = allElements.find(
      (e) =>
        e.craft.related &&
        node.displayName === e.craft.displayName &&
        e.craft.related.fields &&
        e.craft.related.segment_type
    );
    if (matchElement) {
      const related = matchElement.craft.related;
      const s = { type: related.segment_type, ...customProps };
      if (related.hasContents) s.contents = get_nodes(node);
      related.fields.forEach((f) => {
        if (f.type === "Nodes" && f.nodeID) {
          //console.log("nodetype", node);
          s[f.segment_name || f.name || f] = go(
            nodes[node.linkedNodes[f.nodeID]]
          );
        } else s[f.segment_name || f.name || f] = node.props[f.name || f];
      });
      if (related.fields.some((f) => f.canBeFormula))
        s.isFormula = node.props.isFormula;
      if (related.segment_vars) Object.assign(s, related.segment_vars);
      if (related.column_type) {
        const c = { type: related.column_type };
        related.fields.forEach((f) => {
          c[f.column_name || f.name || f] = node.props[f.name || f];
        });
        if (s.isFormula) c.isFormula = s.isFormula;
        columns.push(c);
      }
      return s;
    }
    if (node.displayName === ListColumns.craft.displayName) {
      return {
        besides: node.nodes.map((nm) => go(nodes[nm])),
        list_columns: true,
        ...customProps,
      };
    }
    if (node.displayName === ListColumn.craft.displayName) {
      const contents = go(nodes[node.linkedNodes.listcol]);
      const addFields = options.additionalColumnFields;
      const lc = {
        contents,
        col_width: node.props.col_width,
        col_width_units: node.props.col_width_units,
        alignment: node.props.alignment,
        header_label: node.props.header_label,
        showif: node.props.showif,
        ...customProps,
      };
      (addFields || []).forEach((f) => {
        lc[f.name] = node.props[f.name];
      });
      return lc;
    }
    if (node.isCanvas) {
      if (node.displayName === Container.craft.displayName)
        return {
          contents: get_nodes(node),
          type: "container",
          customCSS: node.props.customCSS,
          customClass: node.props.customClass,
          customId: node.props.customId,
          animateName: node.props.animateName,
          animateDelay: node.props.animateDelay,
          animateDuration: node.props.animateDuration,
          animateInitialHide: node.props.animateInitialHide,
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
          htmlElement: node.props.htmlElement,
          margin: node.props.margin,
          padding: node.props.padding,
          overflow: node.props.overflow,
          display: node.props.display,
          fullPageWidth: node.props.fullPageWidth || false,
          bgFileId: node.props.bgFileId,
          bgField: node.props.bgField,
          bgType: node.props.bgType,
          imageSize: node.props.imageSize,
          imgResponsiveWidths: node.props.imgResponsiveWidths,
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
          click_action: node.props.click_action,
          rotate: node.props.rotate,
          style: node.props.style,
          transform: node.props.transform,
          ...customProps,
        };
      else return get_nodes(node);
    }

    if (node.displayName === Text.craft.displayName) {
      return {
        type: "blank",
        contents: node.props.text,
        block: node.props.block,
        inline: node.props.inline,
        textStyle: node.props.textStyle,
        isFormula: node.props.isFormula,
        labelFor: node.props.labelFor,
        customClass: node.props.customClass,
        style: node.props.style,
        icon: node.props.icon,
        font: node.props.font,
        ...customProps,
      };
    }

    if (node.displayName === Table.craft.displayName) {
      const rows = node.props.rows;
      const columns = node.props.columns;

      const contents = ntimes(rows, (ri) =>
        ntimes(columns, (ci) => go(nodes[node.linkedNodes[`cell_${ri}_${ci}`]]))
      );
      return {
        type: "table",
        rows,
        columns,
        contents,
        bs_style: node.props.bs_style,
        bs_small: node.props.bs_small,
        bs_striped: node.props.bs_striped,
        bs_bordered: node.props.bs_bordered,
        bs_borderless: node.props.bs_borderless,
        bs_wauto: node.props.bs_wauto,
        ...customProps,
      };
    }

    if (node.displayName === Columns.craft.displayName) {
      const widths = [...node.props.widths, 12 - sum(node.props.widths)];
      return {
        besides: widths.map((w, ix) => go(nodes[node.linkedNodes["Col" + ix]])),
        breakpoints: node.props.breakpoints,
        gx: +node.props.gx,
        gy: +node.props.gy,
        aligns: node.props.aligns,
        vAligns: node.props.vAligns,
        colClasses: node.props.colClasses,
        colStyles: node.props.colStyles,
        style: node.props.style,
        widths,
        ...customProps,
      };
    }
    if (node.displayName === Tabs.craft.displayName) {
      let contents;
      if (node.props.tabsStyle === "Value switch") {
        contents = node.props.titles.map(({ value }, ix) => {
          const useIx = typeof value === "undefined" ? ix : value;
          return go(nodes[node.linkedNodes["Tab" + useIx]]);
        });
      } else
        contents = ntimes(node.props.ntabs, (ix) =>
          go(nodes[node.linkedNodes["Tab" + ix]])
        );
      return {
        type: "tabs",
        contents,
        titles: node.props.titles,
        showif: node.props.showif,
        tabsStyle: node.props.tabsStyle,
        field: node.props.field,
        independent: node.props.independent,
        startClosed: node.props.startClosed,
        acc_init_opens: node.props.acc_init_opens,
        deeplink: node.props.deeplink,
        disable_inactive: node.props.disable_inactive,
        serverRendered: node.props.serverRendered,
        tabId: node.props.tabId,
        ntabs: node.props.ntabs,
        setting_tab_n: node.props.setting_tab_n,
        ...customProps,
      };
    }

    if (node.displayName === View.craft.displayName) {
      return {
        type: "view",
        view: node.props.view,
        relation: node.props.relation,
        order_field: node.props.order_field,
        name:
          node.props.name === "not_assigned" ? rand_ident() : node.props.name,
        state: node.props.state,
        configuration: node.props.configuration,
        extra_state_fml: node.props.extra_state_fml,
        ...customProps,
      };
    }
    if (node.displayName === Action.craft.displayName) {
      const newid = rand_ident();
      columns.push({
        type: "Action",
        action_name: node.props.name,
        ...(node.props.name !== "Clear" && node.props.action_row_variable
          ? {
              action_row_variable: node.props.action_row_variable,
              action_row_limit: node.props.action_row_limit,
            }
          : {}),
        action_label: node.props.action_label,
        action_style: node.props.action_style,
        action_size: node.props.action_size,
        action_icon: node.props.action_icon,
        action_title: node.props.action_title,
        action_class: node.props.action_class,
        action_bgcol: node.props.action_bgcol,
        action_bordercol: node.props.action_bordercol,
        action_textcol: node.props.action_textcol,
        minRole: node.props.minRole,
        confirm: node.props.confirm,
        spinner: node.props.spinner,
        is_submit_action: node.props.is_submit_action,
        nsteps: node.props.nsteps,
        step_only_ifs: node.props.step_only_ifs,
        step_action_names: node.props.step_action_names,
        configuration: node.props.configuration,
        isFormula: node.props.isFormula,
        rndid: node.props.rndid === "not_assigned" ? newid : node.props.rndid,
      });
      return {
        type: "action",
        block: node.props.block,
        configuration: node.props.configuration,
        confirm: node.props.confirm,
        is_submit_action: node.props.is_submit_action,
        action_name: node.props.name,
        ...(node.props.name !== "Clear" && node.props.action_row_variable
          ? {
              action_row_variable: node.props.action_row_variable,
              action_row_limit: node.props.action_row_limit,
            }
          : {}),
        action_label: node.props.action_label,
        action_style: node.props.action_style,
        action_size: node.props.action_size,
        action_icon: node.props.action_icon,
        action_title: node.props.action_title,
        action_class: node.props.action_class,
        action_bgcol: node.props.action_bgcol,
        spinner: node.props.spinner,
        action_bordercol: node.props.action_bordercol,
        action_textcol: node.props.action_textcol,
        nsteps: node.props.nsteps,
        step_only_ifs: node.props.step_only_ifs,
        step_action_names: node.props.step_action_names,
        minRole: node.props.minRole,
        isFormula: node.props.isFormula,
        rndid: node.props.rndid === "not_assigned" ? newid : node.props.rndid,
        ...customProps,
      };
    }
  };
  const layout = go(nodes[startFrom]) || { type: "blank", contents: "" };
  /*console.log("nodes", JSON.stringify(nodes));
    console.log("cols", JSON.stringify(columns));
  console.log("layout", JSON.stringify(layout));*/
  return { columns, layout };
};
