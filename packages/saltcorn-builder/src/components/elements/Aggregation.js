import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleSetting } from "./utils";

export const Aggregation = ({
  agg_relation,
  agg_field,
  stat,
  block,
  textStyle,
}) => {
  const {
    connectors: { connect, drag },
  } = useNode();
  return (
    <span
      className={textStyle}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
      [{stat} {agg_relation} {agg_field}]
    </span>
  );
};

export const AggregationSettings = () => {
  const { setProp, agg_relation, agg_field, stat, block, textStyle } = useNode(
    (node) => ({
      agg_relation: node.data.props.agg_relation,
      agg_field: node.data.props.agg_field,
      stat: node.data.props.stat,
      block: node.data.props.block,
      textStyle: node.data.props.textStyle,
    })
  );
  const options = useContext(optionsCtx);
  return (
    <div>
      <div>
        <label>Relation</label>
        <select
          value={agg_relation}
          onChange={(e) =>
            setProp((prop) => (prop.agg_relation = e.target.value))
          }
        >
          {options.child_field_list.map((f, ix) => (
            <option key={ix} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>Child table field</label>
        <select
          value={agg_field}
          onChange={(e) => setProp((prop) => (prop.agg_field = e.target.value))}
        >
          {(options.agg_field_opts[agg_relation] || []).map((f, ix) => (
            <option key={ix} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>Statistic</label>
        <select
          value={stat}
          onChange={(e) => setProp((prop) => (prop.stat = e.target.value))}
        >
          <option value={"Count"}>Count</option>
          <option value={"Avg"}>Avg</option>
          <option value={"Sum"}>Sum</option>
          <option value={"Max"}>Max</option>
          <option value={"Min"}>Min</option>
        </select>
      </div>
      <BlockSetting block={block} setProp={setProp} />
      <TextStyleSetting textStyle={textStyle} setProp={setProp} />
    </div>
  );
};

Aggregation.craft = {
  related: {
    settings: AggregationSettings,
  },
};
