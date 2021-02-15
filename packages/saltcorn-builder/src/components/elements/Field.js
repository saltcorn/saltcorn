import React, { useContext, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import {
  blockProps,
  BlockSetting,
  TextStyleRow,
  ConfigForm,
  setInitialConfig,
} from "./utils";

export const Field = ({ name, fieldview, block, textStyle }) => {
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
      [{fieldview} {name}]
    </span>
  );
};

export const FieldSettings = () => {
  const {
    actions: { setProp },
    name,
    fieldview,
    block,
    configuration,
    textStyle,
  } = useNode((node) => ({
    name: node.data.props.name,
    fieldview: node.data.props.fieldview,
    block: node.data.props.block,
    textStyle: node.data.props.textStyle,
    configuration: node.data.props.configuration,
  }));
  const options = useContext(optionsCtx);
  const fvs = options.field_view_options[name];
  const handlesTextStyle = (options.handlesTextStyle || {})[name];
  const getCfgFields = (fv) =>
    ((options.fieldViewConfigForms || {})[name] || {})[fv];
  const cfgFields = getCfgFields(fieldview);
  return (
    <Fragment>
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
                  if (newfvs && newfvs.length > 0)
                    setProp((prop) => (prop.fieldview = newfvs[0]));
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
              <BlockSetting block={block} setProp={setProp} />
            </td>
          </tr>
          {!(handlesTextStyle && handlesTextStyle.includes(fieldview)) && (
            <TextStyleRow textStyle={textStyle} setProp={setProp} />
          )}
        </tbody>
      </table>{" "}
      {cfgFields ? (
        <ConfigForm
          fields={cfgFields}
          configuration={configuration}
          setProp={setProp}
        />
      ) : null}
    </Fragment>
  );
};

Field.craft = {
  displayName: "Field",
  related: {
    settings: FieldSettings,
  },
};
