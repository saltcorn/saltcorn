import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleRow } from "./utils";

export const Aggregation = ({
  agg_relation,
  agg_field,
  stat,
  block,
  textStyle,
}) => {
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

export const AggregationSettings = () => {
  const {
    actions: { setProp },
    agg_relation,
    agg_field,
    stat,
    block,
    textStyle,
  } = useNode((node) => ({
    agg_relation: node.data.props.agg_relation,
    agg_field: node.data.props.agg_field,
    stat: node.data.props.stat,
    block: node.data.props.block,
    textStyle: node.data.props.textStyle,
  }));
  const options = useContext(optionsCtx);
  return (
    <table>
      <tbody>
        <tr>
          <td>
            <label>Relation</label>
          </td>
          <td>
            <select
              className="form-control"
              value={agg_relation}
              onChange={(e) =>
                setProp((prop) => {
                  prop.agg_relation = e.target.value;
                  const fs = options.agg_field_opts[e.target.value];
                  if (fs && fs.length > 0) prop.agg_field = fs[0];
                })
              }
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
              className="form-control"
              value={agg_field}
              onChange={(e) =>
                setProp((prop) => (prop.agg_field = e.target.value))
              }
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
              className="form-control"
              onChange={(e) => setProp((prop) => (prop.stat = e.target.value))}
            >
              <option value={"Count"}>Count</option>
              <option value={"Avg"}>Avg</option>
              <option value={"Sum"}>Sum</option>
              <option value={"Max"}>Max</option>
              <option value={"Min"}>Min</option>
            </select>
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

Aggregation.craft = {
  displayName: "Aggregation",
  related: {
    settings: AggregationSettings,
  },
};
