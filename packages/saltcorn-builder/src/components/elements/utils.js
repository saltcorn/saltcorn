import React, { Fragment, useContext } from "react";
import optionsCtx from "../context";

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

export const MinRoleSetting = ({ minRole, setProp }) => {
  const options = useContext(optionsCtx);
  return (
    <div>
      <label>Minimum Role</label>
      <select
        value={minRole}
        onChange={e => setProp(prop => (prop.minRole = e.target.value))}
      >
        {options.roles.map(r => (
          <option key={r.id} value={r.id}>
            {r.role}
          </option>
        ))}
      </select>
    </div>
  );
};

export const TextStyleSetting = ({ textStyle, setProp }) => {
  return (
    <div>
      <label>Text Style</label>
      <select
        value={textStyle}
        onChange={e => setProp(prop => (prop.textStyle = e.target.value))}
      >
        <option value="">Normal</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="h4">Heading 4</option>
        <option value="h5">Heading 5</option>
        <option value="h6">Heading 6</option>
        <option value="font-weight-bold">Bold</option>
        <option value="font-italic">Italics</option>
        <option value="small">Small</option>
      </select>
    </div>
  );
};
