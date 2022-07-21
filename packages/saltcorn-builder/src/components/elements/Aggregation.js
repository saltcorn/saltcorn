/**
 * @category saltcorn-builder
 * @module components/elements/Aggregation
 * @subcategory components / elements
 */

import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleRow, setAPropGen } from "./utils";

export /**
 * @param {object} props
 * @param {string} props.agg_relation
 * @param {string} props.agg_field
 * @param {string} props.stat
 * @param {boolean} props.block
 * @param {string} props.textStyle
 * @returns {span}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const Aggregation = ({ agg_relation, agg_field, stat, block, textStyle }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <span
      className={`${textStyle} ${selected ? "selected-node" : ""}`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
      [{stat} {agg_relation} {agg_field}]
    </span>
  );
};

export /**
 * @returns {table}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const AggregationSettings = () => {
  const {
    actions: { setProp },
    agg_relation,
    agg_field,
    stat,
    aggwhere,
    block,
    textStyle,
  } = useNode((node) => ({
    agg_relation: node.data.props.agg_relation,
    agg_field: node.data.props.agg_field,
    aggwhere: node.data.props.aggwhere,
    stat: node.data.props.stat,
    block: node.data.props.block,
    textStyle: node.data.props.textStyle,
  }));
  const options = useContext(optionsCtx);
  const setAProp = setAPropGen(setProp);

  return (
    <table>
      <tbody>
        <tr>
          <td>
            <label>Relation</label>
          </td>
          <td>
            <select
              className="form-control form-select"
              value={agg_relation}
              onChange={(e) => {
                if (!e.target) return;
                const value = e.target.value;
                setProp((prop) => {
                  prop.agg_relation = value;
                  const fs = options.agg_field_opts[value];
                  if (fs && fs.length > 0) prop.agg_field = fs[0];
                });
              }}
            >
              {options.child_field_list.map((f, ix) => (
                <option key={ix} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </td>
        </tr>
        <tr>
          <td>
            <label>Child table field</label>
          </td>
          <td>
            <select
              className="form-control form-select"
              value={agg_field}
              onChange={setAProp("agg_field")}
            >
              {(options.agg_field_opts[agg_relation] || []).map((f, ix) => (
                <option key={ix} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </td>
        </tr>
        <tr>
          <td>
            <label>Statistic</label>
          </td>
          <td>
            <select
              value={stat}
              className="form-control form-select"
              onChange={setAProp("stat")}
            >
              <option value={"Count"}>Count</option>
              <option value={"Avg"}>Avg</option>
              <option value={"Sum"}>Sum</option>
              <option value={"Max"}>Max</option>
              <option value={"Min"}>Min</option>
              <option value={"Array_Agg"}>Array_Agg</option>
              {options.fields
                .filter((f) => f.type.name === "Date")
                .map((f) => (
                  <option value={`Latest ${f.name}`}>Latest {f.name}</option>
                ))}
            </select>
          </td>
        </tr>
        <tr>
          <td>
            <label>Where</label>
          </td>
          <td>
            <input
              type="text"
              className="form-control"
              value={aggwhere}
              onChange={setAProp("aggwhere")}
            />
          </td>
        </tr>
        <TextStyleRow textStyle={textStyle} setProp={setProp} />
        <tr>
          <td colSpan="2">
            <BlockSetting block={block} setProp={setProp} />
          </td>
        </tr>
      </tbody>
    </table>
  );
};

/**
 * @type {object}
 */
Aggregation.craft = {
  displayName: "Aggregation",
  related: {
    settings: AggregationSettings,
    segment_type: "aggregation",
    column_type: "Aggregation",
    fields: [
      "agg_relation",
      "textStyle",
      "block",
      "agg_field",
      "aggwhere",
      "stat",
    ],
  },
};
