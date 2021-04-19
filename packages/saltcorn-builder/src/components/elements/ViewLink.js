import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import {
  blockProps,
  BlockSetting,
  MinRoleSettingRow,
  OrFormula,
} from "./utils";
import FontIconPicker from "@fonticonpicker/react-fonticonpicker";
import faIcons from "./faicons";

export const ViewLink = ({
  name,
  block,
  minRole,
  link_style,
  link_size,
  link_icon,
  inModal,
  label,
  textStyle,
}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const names = name.split(":");
  const displabel = label || (names.length > 1 ? names[1] : names[0]);
  return (
    <span
      className={`${textStyle} ${inModal ? "btn btn-secondary btn-sm" : ""} ${
        selected ? "selected-node" : "is-builder-link"
      } ${link_style} ${link_size}`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
      {link_icon ? <i className={`${link_icon} mr-1`}></i> : ""}
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
    link_style: node.data.props.link_style,
    link_size: node.data.props.link_size,
    link_icon: node.data.props.link_icon,
    textStyle: node.data.props.textStyle,
  }));
  const {
    actions: { setProp },
    name,
    block,
    minRole,
    label,
    isFormula,
    inModal,
    link_style,
    link_icon,
    link_size,
    textStyle,
  } = node;
  const options = useContext(optionsCtx);
  return (
    <div>
      <div>
        <label>View to link to</label>
        <select
          value={name}
          className="form-control"
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
      <div>
        <label>Link style</label>
        <select
          className="form-control"
          value={link_style}
          onChange={(e) =>
            setProp((prop) => (prop.link_style = e.target.value))
          }
        >
          <option value="">Link</option>
          <option value="btn btn-primary">Primary button</option>
          <option value="btn btn-secondary">Secondary button</option>
          <option value="btn btn-success">Success button</option>
          <option value="btn btn-danger">Danger button</option>
          <option value="btn btn-outline-primary">
            Primary outline button
          </option>
          <option value="btn btn-outline-secondary">
            Secondary outline button
          </option>
        </select>
      </div>
      <div>
        <label>Link size</label>
        <select
          className="form-control"
          value={link_size}
          onChange={(e) => setProp((prop) => (prop.link_size = e.target.value))}
        >
          <option value="">Standard</option>
          <option value="btn-lg">Large</option>
          <option value="btn-sm">Small</option>
          <option value="btn-block">Block</option>
          <option value="btn-block btn-lg">Large block</option>
        </select>
      </div>
      <label className="mr-2">Icon</label>
      <FontIconPicker
        value={link_icon}
        icons={faIcons}
        onChange={(value) => setProp((prop) => (prop.link_icon = value))}
        isMulti={false}
      />
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
      <TextStyleSetting textStyle={textStyle} setProp={setProp} />
      <table>
        <tbody>
          <MinRoleSettingRow minRole={minRole} setProp={setProp} />
        </tbody>
      </table>
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
