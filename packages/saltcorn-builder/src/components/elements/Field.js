import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleSetting } from "./utils";

export const Field = ({ name, fieldview, block, textStyle }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return (
    <span
      className={textStyle}
      {...blockProps(block)}
      ref={dom => connect(drag(dom))}
    >
      [{fieldview} {name}]
    </span>
  );
};

export const FieldSettings = () => {
  const { setProp, name, fieldview, block, textStyle } = useNode(node => ({
    name: node.data.props.name,
    fieldview: node.data.props.fieldview,
    block: node.data.props.block,
    textStyle: node.data.props.textStyle
  }));
  const options = useContext(optionsCtx);
  const fvs = options.field_view_options[name];
  return (
    <div>
      <h6>Field settings</h6>
      <div>
        <select
          value={name}
          onChange={e => setProp(prop => (prop.name = e.target.value))}
        >
          {options.fields.map((f, ix) => (
            <option key={ix} value={f.name}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        {fvs && (
          <select
            value={fieldview}
            onChange={e => setProp(prop => (prop.fieldview = e.target.value))}
          >
            {(fvs || []).map((fvnm, ix) => (
              <option key={ix} value={fvnm}>
                {fvnm}
              </option>
            ))}
          </select>
        )}
      </div>
      <BlockSetting block={block} setProp={setProp} />
      <TextStyleSetting textStyle={textStyle} setProp={setProp} />
    </div>
  );
};

Field.craft = {
  related: {
    settings: FieldSettings
  }
};
