/**
 * @category saltcorn-builder
 * @module components/elements/ViewLink
 * @subcategory components / elements
 */

import React, { useMemo } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import relationsCtx from "../relations_context";

import {
  BlockSetting,
  MinRoleSettingRow,
  OrFormula,
  TextStyleSetting,
  ButtonOrLinkSettingsRows,
  setAPropGen,
  FormulaTooltip,
  HelpTopicLink,
  initialRelation,
  buildLayers,
} from "./utils";

import { RelationBadges } from "./RelationBadges";
import { RelationOnDemandPicker } from "./RelationOnDemandPicker";
import Select from "react-select";

import {
  RelationsFinder,
  Relation,
  buildTableCaches,
} from "@saltcorn/common-code";

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

  const displabel = label || (names.length > 1 ? names[1] : names[0]);
  return (
    <span
      className={`${textStyle} ${
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
 * @returns
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
    link_title: node.data.props.link_title,
    link_class: node.data.props.link_class,
    textStyle: node.data.props.textStyle,
    link_bgcol: node.data.props.link_bgcol,
    link_bordercol: node.data.props.link_bordercol,
    link_textcol: node.data.props.link_textcol,
    extra_state_fml: node.data.props.extra_state_fml,
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
    link_target_blank,
  } = node;
  const options = React.useContext(optionsCtx);
  const {
    tables,
    views,
    tableName,
    excluded_subview_templates,
    max_relations_layer_depth,
  } = options;
  const finder = useMemo(
    () => new RelationsFinder(tables, views, max_relations_layer_depth),
    [undefined]
  );
  const tableCaches = useMemo(() => buildTableCaches(tables), [undefined]);
  const { relationsCache, setRelationsCache } = React.useContext(relationsCtx);
  let errorString = false;
  try {
    Function("return " + extra_state_fml);
  } catch (error) {
    errorString = error.message;
  }
  const setAProp = setAPropGen(setProp);
  //legacy values
  const use_view_name =
    name &&
    ((names) => (names.length > 1 ? names[1] : names[0]))(name.split(":"));
  const hasLegacyRelation = name && name.includes(":");
  const safeViewName = use_view_name?.includes(".")
    ? use_view_name.split(".")[0]
    : use_view_name;
  const subView = views.find((view) => view.name === safeViewName);
  const hasTableId = subView?.table_id !== undefined;
  if (!(relationsCache[tableName] && relationsCache[tableName][safeViewName])) {
    const relations = finder.findRelations(
      tableName,
      safeViewName,
      excluded_subview_templates
    );
    const layers = buildLayers(
      relations,
      tableName,
      tableCaches.tableNameCache
    );
    relationsCache[tableName] = relationsCache[tableName] || {};
    relationsCache[tableName][safeViewName] = { relations, layers };
    setRelationsCache({ ...relationsCache });
  }
  const [relationsData, setRelationsData] = React.useState(
    relationsCache[options.tableName][safeViewName]
  );
  let safeRelation = null;
  if (relation && subView) {
    const subView = views.find((view) => view.name === safeViewName);
    const subTbl = tables.find((tbl) => tbl.id === subView.table_id);
    safeRelation = new Relation(
      relation,
      subTbl ? subTbl.name : "",
      subView.display_type
    );
  }
  if (
    !safeRelation &&
    !hasLegacyRelation &&
    relationsData?.relations.length > 0
  ) {
    safeRelation = initialRelation(relationsData.relations);
    setProp((prop) => {
      prop.relation = safeRelation.relationString;
    });
  }
  const set_view_name = (e) => {
    if (e?.target?.value || e?.value) {
      const target_value = e.target?.value || e.value;
      if (target_value !== use_view_name) {
        const newRelations = finder.findRelations(
          tableName,
          target_value,
          excluded_subview_templates
        );
        const layers = buildLayers(
          newRelations,
          tableName,
          tableCaches.tableNameCache
        );

        relationsCache[tableName] = relationsCache[tableName] || {};
        relationsCache[tableName][target_value] = {
          relations: newRelations,
          layers,
        };
        if (newRelations.length > 0) {
          setProp((prop) => {
            prop.name = target_value;
            prop.relation = initialRelation(newRelations).relationString;
          });
          setRelationsData({ relations: newRelations, layers });
        } else
          window.notifyAlert({
            type: "warning",
            text: `${target_value} has no relations`,
          });
      }
    }
  };
  const helpContext = { view_name: use_view_name };
  if (tableName) helpContext.srcTable = tableName;
  const viewOptions = options.views.map(({ name, label }) => ({
    label,
    value: name,
  }));
  const selectedView = viewOptions.find((v) => v.value === use_view_name);
  return (
    <div>
      <table className="w-100">
        <tbody>
          <tr>
            <td colSpan="2">
              <label>View to link to</label>
              {options.inJestTestingMode ? null : (
                <Select
                  options={viewOptions}
                  value={selectedView}
                  onChange={set_view_name}
                  onBlur={set_view_name}
                  menuPortalTarget={document.body}
                  styles={{
                    menuPortal: (base) => ({ ...base, zIndex: 19999 }),
                  }}
                ></Select>
              )}
            </td>
          </tr>
          <tr>
            <td colSpan="2">
              <RelationOnDemandPicker
                relations={relationsData.layers}
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
                relation={safeRelation}
                parentTbl={tableName}
                caches={tableCaches}
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
                Extra state Formula
                <HelpTopicLink topic="Extra state formula" {...helpContext} />
              </label>
              <input
                type="text"
                className="viewlink-label form-control"
                value={extra_state_fml}
                onChange={setAProp("extra_state_fml")}
                spellCheck={false}
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
            allowRunOnLoad={false}
            faIcons={options.icons}
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
          {use_view_name ? (
            <tr>
              <td colSpan="2">
                <a
                  className="d-block mt-2"
                  target="_blank"
                  href={`/viewedit/config/${use_view_name}`}
                >
                  Configure this view
                </a>
              </td>
            </tr>
          ) : null}
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
      "link_icon",
      "link_size",
      "link_title",
      "link_class",
      "link_target_blank",
      "link_bgcol",
      "link_bordercol",
      "link_textcol",
      "extra_state_fml",
    ],
  },
};
