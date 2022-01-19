/**
 * @category saltcorn-builder
 * @module components/elements/Field
 * @subcategory components / elements
 */

import React, { useContext, useEffect, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import previewCtx from "../preview_context";
import {
  blockProps,
  BlockOrInlineSetting,
  TextStyleRow,
  ConfigForm,
  setInitialConfig,
  isBlock,
  fetchFieldPreview,
} from "./utils";

export /**
 * @param {object} props
 * @param {string} props.name
 * @param {string} props.fieldview
 * @param {boolean} props.block
 * @param {string} props.textStyle
 * @param {object} props.configuration
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const Field = ({
  name,
  fieldview,
  block,
  inline,
  textStyle,
  configuration,
}) => {
  const {
    selected,
    node_id,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected, node_id: node.id }));
  const { previews, setPreviews } = useContext(previewCtx);
  const myPreview = previews[node_id];
  const options = useContext(optionsCtx);

  useEffect(() => {
    fetchFieldPreview({
      options,
      name,
      fieldview,
      configuration,
      setPreviews,
      node_id,
    })();
  }, []);
  return (
    <div
      className={`${textStyle} ${selected ? "selected-node" : ""} ${
        isBlock(block, inline, textStyle) ? "d-block" : "d-inline-block"
      }`}
      ref={(dom) => connect(drag(dom))}
    >
      {myPreview ? (
        <div
          className="d-inline"
          dangerouslySetInnerHTML={{ __html: myPreview }}
        ></div>
      ) : (
        `[${fieldview} ${name}]`
      )}
    </div>
  );
};

export /**
 * @returns {Fragment}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const FieldSettings = () => {
  const {
    actions: { setProp },
    name,
    fieldview,
    block,
    inline,
    configuration,
    node_id,
    textStyle,
  } = useNode((node) => ({
    name: node.data.props.name,
    fieldview: node.data.props.fieldview,
    block: node.data.props.block,
    inline: node.data.props.inline,
    textStyle: node.data.props.textStyle,
    configuration: node.data.props.configuration,
    node_id: node.id,
  }));
  const options = useContext(optionsCtx);
  const { setPreviews } = useContext(previewCtx);

  const fvs = options.field_view_options[name];
  const handlesTextStyle = (options.handlesTextStyle || {})[name];
  const getCfgFields = (fv) =>
    ((options.fieldViewConfigForms || {})[name] || {})[fv];
  const cfgFields = getCfgFields(fieldview);
  const refetchPreview = fetchFieldPreview({
    options,
    name,
    fieldview,
    configuration,
    setPreviews,
    node_id,
  });

  return (
    <Fragment>
      <i>
        <small>
          Previews shown in canvas are indicative based on random rows
        </small>
      </i>
      <table className="w-100">
        <tbody>
          <tr>
            <td>
              <label>Field</label>
            </td>
            <td>
              <select
                value={name}
                className="form-control"
                onChange={(e) => {
                  setProp((prop) => (prop.name = e.target.value));
                  const newfvs = options.field_view_options[e.target.value];
                  if (newfvs && newfvs.length > 0) {
                    setProp((prop) => (prop.fieldview = newfvs[0]));
                    refetchPreview({
                      name: e.target.value,
                      fieldview: newfvs[0],
                    });
                  } else refetchPreview({ name: e.target.value });
                }}
              >
                {options.fields.map((f, ix) => (
                  <option key={ix} value={f.name}>
                    {f.label}
                  </option>
                ))}
              </select>
            </td>
          </tr>
          {fvs && (
            <tr>
              <td>
                <label>Field view</label>
              </td>

              <td>
                <select
                  value={fieldview}
                  className="form-control"
                  onChange={(e) => {
                    setProp((prop) => (prop.fieldview = e.target.value));
                    setInitialConfig(
                      setProp,
                      e.target.value,
                      getCfgFields(e.target.value)
                    );
                    refetchPreview({ fieldview: e.target.value });
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
          <tr>
            <td></td>
            <td>
              <BlockOrInlineSetting
                block={block}
                inline={inline}
                textStyle={textStyle}
                setProp={setProp}
              />
            </td>
          </tr>
          {!(handlesTextStyle && handlesTextStyle.includes(fieldview)) && (
            <TextStyleRow textStyle={textStyle} setProp={setProp} />
          )}
        </tbody>
      </table>
      {cfgFields ? (
        <ConfigForm
          fields={cfgFields}
          configuration={configuration}
          setProp={setProp}
          onChange={(k, v) => refetchPreview({ configuration: { [k]: v } })}
        />
      ) : null}
    </Fragment>
  );
};

/**
 * @type {object}
 */
Field.craft = {
  displayName: "Field",
  related: {
    settings: FieldSettings,
    segment_type: "field",
    column_type: "Field",
    fields: [
      { name: "name", segment_name: "field_name", column_name: "field_name" },
      "fieldview",
      "textStyle",
      "block",
      "inline",
      { name: "configuration", default: {} },
    ],
  },
};
