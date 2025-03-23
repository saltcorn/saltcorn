/**
 * @category saltcorn-builder
 * @module components/elements/Aggregation
 * @subcategory components / elements
 */

import React, { useContext, useState, useEffect, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import {
  blockProps,
  BlockSetting,
  TextStyleRow,
  setAPropGen,
  buildOptions,
  ConfigForm,
  HelpTopicLink,
} from "./utils";

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
    agg_fieldview,
    configuration,
  } = useNode((node) => ({
    agg_relation: node.data.props.agg_relation,
    agg_field: node.data.props.agg_field,
    aggwhere: node.data.props.aggwhere,
    stat: node.data.props.stat,
    block: node.data.props.block,
    agg_fieldview: node.data.props.agg_fieldview,
    configuration: node.data.props.configuration,
    textStyle: node.data.props.textStyle,
  }));
  const options = useContext(optionsCtx);
  const setAProp = setAPropGen(setProp);

  const targetField = options.agg_field_opts[agg_relation]?.find?.(
    (f) => f.name === agg_field
  );
  const targetFieldType = targetField?.ftype;
  const outcomeType =
    stat === "Percent true" || stat === "Percent false"
      ? "Float"
      : stat === "Count" || stat === "CountUnique"
        ? "Integer"
        : stat === "Array_Agg"
          ? "Array"
          : targetFieldType;
  const fvs = options.agg_fieldview_options[outcomeType];

  const [fetchedCfgFields, setFetchedCfgFields] = useState([]);
  const cfgFields = fetchedCfgFields;
  useEffect(() => {
    fetch(
      `/field/fieldviewcfgform/${
        targetField?.table_name || options.tableName
      }?accept=json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CSRF-Token": options.csrfToken,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          agg_outcome_type: outcomeType,
          agg_fieldview,
          agg_field: targetField?.name,
          mode: options?.mode,
        }),
      }
    )
      .then(function (response) {
        if (response.status < 399) return response.json();
        else return [];
      })
      .then(setFetchedCfgFields);
  }, [outcomeType, agg_fieldview]);
  return (
    <Fragment>
      <table>
        <tbody>
          {options.mode === "filter" ? null : (
            <tr>
              <td>
                <label>Relation</label>
              </td>
              <td>
                <select
                  className="relation form-control form-select"
                  value={agg_relation}
                  onChange={(e) => {
                    if (!e.target) return;
                    const value = e.target.value;
                    setProp((prop) => {
                      prop.agg_relation = value;
                      const fs = options.agg_field_opts[value];
                      if (fs && fs.length > 0) prop.agg_field = fs[0]?.name;
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
          )}
          <tr>
            <td>
              <label>
                {options.mode === "filter" ? "Field" : "Child table field"}
              </label>
            </td>
            <td>
              <select
                className="agg_field form-control form-select"
                value={agg_field}
                onChange={setAProp("agg_field")}
              >
                {(options.agg_field_opts[agg_relation] || []).map((f, ix) => (
                  <option key={ix} value={f.name}>
                    {f.label}
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
                className="stat form-control form-select"
                onChange={setAProp("stat")}
                onBlur={setAProp("stat")}
              >
                {buildOptions(
                  [
                    "Count",
                    "CountUnique",
                    "Avg",
                    "Sum",
                    "Max",
                    "Min",
                    "Array_Agg",
                  ],
                  { valAttr: true }
                )}
                {targetFieldType === "Bool" ? (
                  <option value={`Percent true`}>Percent true</option>
                ) : null}
                {targetFieldType === "Bool" ? (
                  <option value={`Percent false`}>Percent false</option>
                ) : null}
                {(options.agg_field_opts[agg_relation] || [])
                  .filter((f) => f.ftype === "Date")
                  .map((f, ix) => (
                    <option key={ix} value={`Latest ${f.name}`}>
                      Latest {f.name}
                    </option>
                  ))}
                {(options.agg_field_opts[agg_relation] || [])
                  .filter((f) => f.ftype === "Date")
                  .map((f, ix) => (
                    <option key={ix} value={`Earliest ${f.name}`}>
                      Earliest {f.name}
                    </option>
                  ))}
              </select>
            </td>
          </tr>
          <tr>
            <td>
              <label>
                Where
                <HelpTopicLink
                  topic="Aggregation where formula"
                  table_name={options.tableName}
                  mode={options.mode}
                  agg_relation={agg_relation}
                  agg_field={agg_field}
                ></HelpTopicLink>
              </label>
            </td>
            <td>
              <input
                type="text"
                className="form-control"
                value={aggwhere}
                spellCheck={false}
                onChange={setAProp("aggwhere")}
                onInput={(e) => validate_expression_elem($(e.target))}
              />
            </td>
          </tr>
          {fvs && (
            <tr>
              <td>
                <label>Field view</label>
              </td>

              <td>
                <select
                  value={agg_fieldview}
                  className="agg_fieldview form-control form-select"
                  onChange={(e) => {
                    if (!e.target) return;
                    const value = e.target.value;
                    setProp((prop) => (prop.agg_fieldview = value));
                    //refetchPreview({ fieldview: value });
                  }}
                >
                  {(fvs || []).map((fvnm, ix) => (
                    <option key={ix} value={fvnm}>
                      {fvnm}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          )}

          <TextStyleRow textStyle={textStyle} setProp={setProp} />
          <tr>
            <td colSpan="2">
              <BlockSetting block={block} setProp={setProp} />
            </td>
          </tr>
        </tbody>
      </table>{" "}
      {cfgFields ? (
        <ConfigForm
          fields={cfgFields}
          configuration={configuration || {}}
          setProp={setProp}
        />
      ) : null}
    </Fragment>
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
      "agg_fieldview",
      { name: "configuration", default: {} },
    ],
  },
};
