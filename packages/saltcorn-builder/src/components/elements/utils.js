import React from "react";

export const blockProps = is_block =>
  is_block ? { style: { display: "block" } } : {};

export const BlockSetting = ({ block, setProp }) => (
  <label>
    Block
    <input
      name="block"
      type="checkbox"
      checked={block}
      onChange={e => setProp(prop => (prop.block = e.target.checked))}
    />
  </label>
);
