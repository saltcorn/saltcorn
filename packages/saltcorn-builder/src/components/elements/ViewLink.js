import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, MinRoleSetting, OrFormula } from "./utils";

export const ViewLink = ({ name, block, minRole, inModal, label }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const names = name.split(":");
  const displabel = label || (names.length > 1 ? names[1] : names[0]);
  return (
    <span
      className={`${inModal ? "btn btn-secondary btn-sm" : ""} ${
        selected ? "selected-node" : "is-builder-link"
      }`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
      {displabel}
    </span>
  );
};

export const ViewLinkSettings = () => {
  const node = useNode((node) => ({
    name: node.data.props.name,
    block: node.data.props.block,
    minRole: node.data.props.minRole,
    isFormula: node.data.props.isFormula,
    label: node.data.props.label,
    inModal: node.data.props.inModal,
  }));
  const {
    actions: { setProp },
    name,
    block,
    minRole,
    label,
    isFormula,
    inModal,
  } = node;
  const options = useContext(optionsCtx);
  return (
    <div>
      <div>
        <label>View to link to</label>
        <select
          value={name}
          className="w-100"
          onChange={(e) => setProp((prop) => (prop.name = e.target.value))}
        >
          {options.link_view_opts.map((f, ix) => (
            <option key={ix} value={f.name}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>Label (leave blank for default)</label>
        <OrFormula nodekey="label" {...{ setProp, isFormula, node }}>
          <input
            type="text"
            className="viewlink-label form-control"
            value={label}
            onChange={(e) => setProp((prop) => (prop.label = e.target.value))}
          />
        </OrFormula>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={inModal}
          onChange={(e) => setProp((prop) => (prop.inModal = e.target.checked))}
        />
        <label className="form-check-label">Open in popup modal?</label>
      </div>
      <BlockSetting block={block} setProp={setProp} />
      <MinRoleSetting minRole={minRole} setProp={setProp} />
    </div>
  );
};

ViewLink.craft = {
  displayName: "ViewLink",
  defaultProps: {
    isFormula: {},
  },
  related: {
    settings: ViewLinkSettings,
  },
};
