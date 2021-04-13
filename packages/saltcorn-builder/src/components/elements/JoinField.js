import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleRow } from "./utils";
import { faFontAwesomeLogoFull } from "@fortawesome/free-solid-svg-icons";

export const JoinField = ({ name, block, fieldview, textStyle }) => {
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
      [{name}]
    </span>
  );
};

export const JoinFieldSettings = () => {
  const {
    actions: { setProp },
    name,
    block,
    textStyle,
    fieldview,
  } = useNode((node) => ({
    name: node.data.props.name,
    block: node.data.props.block,
    textStyle: node.data.props.textStyle,
    fieldview: node.data.props.fieldview,
  }));
  const options = useContext(optionsCtx);
  const fvs = options.field_view_options[name];
  return (
    <table className="w-100">
      <tbody>
        <tr>
          <td>
            <label>Join field</label>
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
                }
              }}
            >
              {options.parent_field_list.map((f, ix) => (
                <option key={ix} value={f}>
                  {f}
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

                  //refetchPreview({ fieldview: e.target.value });
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
        <TextStyleRow textStyle={textStyle} setProp={setProp} />
      </tbody>
    </table>
  );
};

JoinField.craft = {
  displayName: "JoinField",
  related: {
    settings: JoinFieldSettings,
  },
};
