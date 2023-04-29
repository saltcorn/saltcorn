/**
 * @category saltcorn-builder
 * @module components/elements/ViewLink
 * @subcategory components / elements
 */

import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import {
  BlockSetting,
  MinRoleSettingRow,
  OrFormula,
  TextStyleSetting,
  ButtonOrLinkSettingsRows,
  setAPropGen,
  FormulaTooltip,
} from "./utils";

import { RelationPicker } from "./RelationPicker";
import { RelationBadges } from "./RelationBadges";

export /**
 * @param {object} props
 * @param {string} props.name
 * @param {boolean} props.block
 * @param {*} props.minRole
 * @param {string} props.link_style
 * @param {string} props.link_size
 * @param {string} [props.link_icon]
 * @param {boolean} props.inModal
 * @param {string} [props.label]
 * @param {string} props.textStyle
 * @param {string} [props.link_bgcol]
 * @param {string} [props.link_bordercol]
 * @param {string} [props.link_textcol]
 * @returns {tr}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const ViewLink = ({
  name,
  block,
  view_name,
  minRole,
  link_style,
  link_size,
  link_icon,
  inModal,
  label,
  textStyle,
  link_bgcol,
  link_bordercol,
  link_textcol,
}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const names = name.split(":");

  const displabel =
    label || view_name || (names.length > 1 ? names[1] : names[0]);
  return (
    <span
      className={`${textStyle} ${inModal ? "btn btn-secondary btn-sm" : ""} ${
        selected ? "selected-node" : "is-builder-link"
      } ${link_style} ${link_size || ""} ${block ? "d-block" : ""}`}
      ref={(dom) => connect(drag(dom))}
      style={
        link_style === "btn btn-custom-color"
          ? {
              backgroundColor: link_bgcol || "#000000",
              borderColor: link_bordercol || "#000000",
              color: link_textcol || "#000000",
            }
          : {}
      }
    >
      {link_icon ? <i className={`${link_icon} me-1`}></i> : ""}
      {displabel}
    </span>
  );
};

export /**
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const ViewLinkSettings = () => {
  const node = useNode((node) => ({
    name: node.data.props.name,
    relation: node.data.props.relation,
    block: node.data.props.block,
    minRole: node.data.props.minRole,
    isFormula: node.data.props.isFormula,
    label: node.data.props.label,
    inModal: node.data.props.inModal,
    link_target_blank: node.data.props.link_target_blank,
    link_style: node.data.props.link_style,
    link_size: node.data.props.link_size,
    link_icon: node.data.props.link_icon,
    textStyle: node.data.props.textStyle,
    link_bgcol: node.data.props.link_bgcol,
    link_bordercol: node.data.props.link_bordercol,
    link_textcol: node.data.props.link_textcol,
    extra_state_fml: node.data.props.extra_state_fml,
    view_name: node.data.props.view_name,
  }));
  const {
    actions: { setProp },
    name,
    relation,
    block,
    minRole,
    label,
    isFormula,
    inModal,
    textStyle,
    extra_state_fml,
    view_name,
    link_target_blank,
  } = node;
  const options = useContext(optionsCtx);
  let errorString = false;
  try {
    Function("return " + extra_state_fml);
  } catch (error) {
    errorString = error.message;
  }
  const setAProp = setAPropGen(setProp);
  //legacy values
  const use_view_name =
    view_name ||
    (name &&
      ((names) => (names.length > 1 ? names[1] : names[0]))(name.split(":")));
  const set_view_name = (e) => {
    if (e.target) {
      const target_value = e.target.value;
      setProp((prop) => (prop.view_name = target_value));
      if (target_value !== use_view_name) {
        setProp((prop) => {
          prop.name = options.view_relation_opts[target_value][0].value;
          prop.relation = undefined;
        });
      }
    }
  };
  return (
    <div>
      <table className="w-100">
        <tbody>
          <tr>
            <td colSpan="2">
              <label>View to link to</label>
              <select
                value={use_view_name}
                className="form-control form-select"
                onChange={set_view_name}
                onBlur={set_view_name}
              >
                {options.view_name_opts.map((f, ix) => (
                  <option key={ix} value={f.name}>
                    {f.label}
                  </option>
                ))}
              </select>
            </td>
          </tr>
          <tr>
            <td colSpan="2">
              <RelationPicker
                options={options}
                viewname={use_view_name}
                update={(relPath) => {
                  if (relPath.startsWith(".")) {
                    setProp((prop) => {
                      prop.name = use_view_name;
                      prop.relation = relPath;
                    });
                  } else {
                    setProp((prop) => {
                      prop.name = relPath;
                      prop.relation = undefined;
                    });
                  }
                }}
              />
              <RelationBadges
                view={name}
                relation={relation}
                parentTbl={options.tableName}
                fk_options={options.fk_options}
              />
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
                  onChange={setAProp("label")}
                />
              </OrFormula>
            </td>
          </tr>
          <tr>
            <td colSpan="2">
              <label>
                Extra state Formula <FormulaTooltip />
              </label>
              <input
                type="text"
                className="viewlink-label form-control"
                value={extra_state_fml}
                onChange={setAProp("extra_state_fml")}
              />
              {errorString ? (
                <small className="text-danger font-monospace d-block">
                  {errorString}
                </small>
              ) : null}
            </td>
          </tr>

          <ButtonOrLinkSettingsRows
            setProp={setProp}
            keyPrefix="link_"
            btnClass="btn"
            values={node}
            linkFirst={true}
            linkIsBlank={true}
          />
        </tbody>
      </table>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={link_target_blank}
          onChange={setAProp("link_target_blank", { checked: true })}
        />
        <label className="form-check-label">Open in new tab</label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={inModal}
          onChange={setAProp("inModal", { checked: true })}
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

/**
 * @type {object}
 */
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
      "relation",
      { name: "label", segment_name: "view_label", canBeFormula: true },
      "block",
      "textStyle",
      { name: "inModal", segment_name: "in_modal", column_name: "in_modal" },
      "minRole",
      "link_style",
      "view_name",
      "link_icon",
      "link_size",
      "link_target_blank",
      "link_bgcol",
      "link_bordercol",
      "link_textcol",
      "extra_state_fml",
    ],
  },
};
