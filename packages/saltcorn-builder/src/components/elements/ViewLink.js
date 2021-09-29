import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import {
  blockProps,
  BlockSetting,
  MinRoleSettingRow,
  OrFormula,
  TextStyleSetting,
  ButtonOrLinkSettingsRows,
} from "./utils";

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
      <table className="w-100">
        <tbody>
          <tr>
            <td colSpan="2">
              <label>View to link to</label>

              <select
                value={name}
                className="form-control"
                onChange={(e) =>
                  setProp((prop) => (prop.name = e.target.value))
                }
              >
                {options.link_view_opts.map((f, ix) => (
                  <option key={ix} value={f.name}>
                    {f.label}
                  </option>
                ))}
              </select>
            </td>
          </tr>
          <tr>
            <td colSpan="2">
              <label>Label (leave blank for default)</label>

              <OrFormula nodekey="label" {...{ setProp, isFormula, node }}>
                <input
                  type="text"
                  className="viewlink-label form-control"
                  value={label}
                  onChange={(e) =>
                    setProp((prop) => (prop.label = e.target.value))
                  }
                />
              </OrFormula>
            </td>
          </tr>
          <ButtonOrLinkSettingsRows
            setProp={setProp}
            keyPrefix="link_"
            btnClass="btn"
            values={node}
            linkFirst={true}
          />
        </tbody>
      </table>
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
    segment_type: "view_link",
    column_type: "ViewLink",
    fields: [
      { name: "name", segment_name: "view", column_name: "view" },
      { name: "label", segment_name: "view_label", canBeFormula: true },
      "block",
      "textStyle",
      { name: "inModal", segment_name: "in_modal", column_name: "in_modal" },
      "minRole",
      "link_style",
      "link_icon",
      "link_size",
    ],
  },
};
