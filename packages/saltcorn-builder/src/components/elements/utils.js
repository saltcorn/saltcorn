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
