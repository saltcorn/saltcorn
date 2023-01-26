/**
 * @category saltcorn-builder
 * @module components/elements/JoinField
 * @subcategory components / elements
 */
/* eslint-env jquery */

import React, { useContext, useEffect, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import {
  blockProps,
  BlockSetting,
  TextStyleRow,
  ConfigForm,
  fetchFieldPreview,
} from "./utils";
import previewCtx from "../preview_context";

export /**
 * @param {object} props
 * @param {string} props.name
 * @param {boolean} props.block
 * @param {object} props.fieldview
 * @param {string} props.textStyle
 * @returns {span}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const JoinField = ({ name, block, fieldview, textStyle }) => {
  const {
    selected,
    node_id,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected, node_id: node.id }));
  const { previews, setPreviews } = useContext(previewCtx);
  const myPreview = previews[node_id];
  const options = useContext(optionsCtx);

  useEffect(() => {
    fetchFieldPreview({
      options,
      name,
      fieldview,
      configuration: {},
      setPreviews,
      node_id,
    })();
  }, []);
  return (
    <span
      className={`${textStyle} ${selected ? "selected-node" : ""}`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
      {myPreview ? (
        <div
          className="d-inline"
          dangerouslySetInnerHTML={{ __html: myPreview }}
        ></div>
      ) : (
        `[${name}]`
      )}
    </span>
  );
};

const buildFieldsMenu = (options, setProp, refetchPreview) => {
  const { join_field_options } = options.join_field_picker_data;
  return (
    <div className="dropdown">
      <button
        id="f-top-dropdown"
        type="button"
        onClick={() => {
          $(
            "#f-top-dropdown,.dropdown-submenu.show,#r-top-dropdown.show"
          ).dropdown("toggle");
        }}
        className="btn btn-outline-primary dropdown-toggle"
        aria-expanded="false"
      >
        Fields
      </button>
      <div className="dropdown-menu">
        <ul className="ps-0 mb-0">
          {join_field_options
            .filter(
              (field) =>
                field.subFields &&
                field.subFields.find(
                  ({ fieldPath }) =>
                    options.parent_field_list.indexOf(fieldPath) >= 0
                )
            )
            .map((field) => {
              return (
                <li
                  key={`_li_${field.fieldPath}`}
                  className="dropdown-item dropstart"
                >
                  <div
                    id={`_field_${field.fieldPath}`}
                    className="dropdown-toggle dropdown-submenu"
                    onClick={toggleSubmenu}
                    role="button"
                    aria-expanded="false"
                  >
                    {field.name}
                  </div>
                  <div className="dropdown-menu">
                    <h5 className="join-table-header">{field.table}</h5>
                    <ul className="ps-0">
                      {field.subFields
                        .filter(
                          (f) =>
                            options.parent_field_list.indexOf(f.fieldPath) >= 0
                        )
                        .map((subOne) => {
                          return subOne.subFields &&
                            subOne.subFields.length > 0 ? (
                            <li
                              key={`_li_${subOne.fieldPath}`}
                              className="dropdown-item dropstart"
                            >
                              <div
                                id={`_field_${subOne.fieldPath}`}
                                className="dropdown-toggle dropdown-submenu"
                                onClick={toggleSubmenu}
                                role="button"
                                aria-expanded="false"
                              >
                                {subOne.name}
                              </div>
                              <div className="dropdown-menu">
                                <h5 className="join-table-header">
                                  {subOne.table}
                                </h5>
                                <ul className="ps-0">
                                  {subOne.subFields
                                    .filter(
                                      (f) =>
                                        options.parent_field_list.indexOf(
                                          f.fieldPath
                                        ) >= 0
                                    )
                                    .map((subTwo) => {
                                      return subTwo.subFields &&
                                        subTwo.subFields.length > 0 ? (
                                        <li
                                          key={`_li_${subTwo.fieldPath}`}
                                          className="dropdown-item dropstart"
                                        >
                                          <div
                                            id={`_field_${subTwo.fieldPath}`}
                                            className="dropdown-toggle dropdown-submenu"
                                            onClick={toggleSubmenu}
                                            role="button"
                                            aria-expanded="false"
                                          >
                                            {subTwo.name}
                                          </div>
                                          <div className="dropdown-menu">
                                            <h5 className="join-table-header">
                                              {subTwo.table}
                                            </h5>
                                            <ul className="ps-0">
                                              {subTwo.subFields
                                                .filter(
                                                  (f) =>
                                                    options.parent_field_list.indexOf(
                                                      f.fieldPath
                                                    ) >= 0
                                                )
                                                .map((subThree) => {
                                                  return (
                                                    <li
                                                      key={`_li_${subThree.fieldPath}`}
                                                      className="dropdown-item field-val-item"
                                                      onClick={(e) =>
                                                        joinFieldClicked(
                                                          subThree.fieldPath,
                                                          setProp,
                                                          options,
                                                          refetchPreview
                                                        )
                                                      }
                                                      role="button"
                                                    >
                                                      {subThree.name}
                                                    </li>
                                                  );
                                                })}
                                            </ul>
                                          </div>
                                        </li>
                                      ) : (
                                        <li
                                          key={`_li_${subTwo.fieldPath}`}
                                          className="dropdown-item field-val-item"
                                          onClick={(e) =>
                                            joinFieldClicked(
                                              subTwo.fieldPath,
                                              setProp,
                                              options,
                                              refetchPreview
                                            )
                                          }
                                          role="button"
                                        >
                                          {subTwo.name}
                                        </li>
                                      );
                                    })}
                                </ul>
                              </div>
                            </li>
                          ) : (
                            <li
                              key={`_li_${subOne.fieldPath}`}
                              className="dropdown-item field-val-item"
                              onClick={(e) =>
                                joinFieldClicked(
                                  subOne.fieldPath,
                                  setProp,
                                  options,
                                  refetchPreview
                                )
                              }
                              role="button"
                            >
                              {subOne.name}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
};

const buildRelationsMenu = (
  options,
  setProp,
  refetchPreview,
  hasFieldsPicker
) => {
  const { relation_options } = options.join_field_picker_data;
  return (
    <div className={`dropdown ${hasFieldsPicker ? "ps-2" : ""}`}>
      <button
        id="r-top-dropdown"
        type="button"
        onClick={() => {
          $(
            "#r-top-dropdown,.dropdown-submenu.show,#f-top-dropdown.show"
          ).dropdown("toggle");
        }}
        className="btn btn-outline-primary dropdown-toggle"
        aria-expanded="false"
      >
        Relations
      </button>
      <div className="dropdown-menu">
        <ul className="ps-0 mb-0">
          {relation_options
            .filter(
              (join) =>
                options.parent_field_list.find((f) =>
                  f.startsWith(join.relationPath)
                ) !== undefined
            )
            .map((join) => {
              return (
                <li
                  key={`_li_${join.relationPath}`}
                  className="dropdown-item dropstart"
                >
                  <div
                    id={`_relation_${join.relationPath}`}
                    className="dropdown-toggle dropdown-submenu"
                    onClick={toggleRelationsSubmenu}
                    role="button"
                    aria-expanded="false"
                  >
                    {join.relationPath}
                  </div>
                  <div className="dropdown-menu">
                    <ul className="ps-0 mb-0">
                      {join.relationFields
                        .filter(
                          (fName) =>
                            options.parent_field_list.indexOf(
                              `${join.relationPath}->${fName}`
                            ) >= 0
                        )
                        .map((fName) => {
                          const fullPath = `${join.relationPath}->${fName}`;
                          return (
                            <li
                              key={`_li_${fullPath}`}
                              className="dropdown-item field-val-item"
                              onClick={(e) => {
                                joinFieldClicked(
                                  fullPath,
                                  setProp,
                                  options,
                                  refetchPreview
                                );
                              }}
                              role="button"
                            >
                              {fName}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
};

function toggleRelationsSubmenu(e) {
  $(".dropdown-submenu.show").dropdown("toggle");
  $(document.getElementById(`${e.target.id}`)).dropdown("toggle");
}

function toggleSubmenu(e) {
  $(document.getElementById(`${e.target.id}`)).dropdown("toggle");
  const clickedField = e.target.id.replace("_field_", "");
  $(".dropdown-submenu.show").each(function (index) {
    const openField = this.id.replace("_field_", "");
    if (clickedField.indexOf(openField) < 0) {
      $(this).dropdown("toggle");
    }
  });
}

function joinFieldClicked(fieldPath, setProp, options, refetchPreview) {
  setProp((prop) => (prop.name = fieldPath));
  const newfvs = options.field_view_options[fieldPath];
  if (newfvs && newfvs.length > 0) {
    setProp((prop) => (prop.fieldview = newfvs[0]));
    refetchPreview({
      name: fieldPath,
      fieldview: newfvs[0],
    });
  } else refetchPreview({ name: fieldPath });
  $(
    ".dropdown-submenu.show,#f-top-dropdown.show,#r-top-dropdown.show"
  ).dropdown("toggle");
}

export /**
 * @returns {Fragment}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const JoinFieldSettings = () => {
  const {
    actions: { setProp },
    name,
    block,
    textStyle,
    configuration,
    fieldview,
    node_id,
  } = useNode((node) => ({
    name: node.data.props.name,
    block: node.data.props.block,
    textStyle: node.data.props.textStyle,
    fieldview: node.data.props.fieldview,
    configuration: node.data.props.configuration,

    node_id: node.id,
  }));
  const options = useContext(optionsCtx);
  const { setPreviews } = useContext(previewCtx);

  const fvs = options.field_view_options[name];
  const getCfgFields = (fv) =>
    ((options.fieldViewConfigForms || {})[name] || {})[fv];
  const cfgFields = getCfgFields(fieldview);
  const refetchPreview = fetchFieldPreview({
    options,
    name,
    fieldview,
    configuration,
    setPreviews,
    node_id,
  });
  const showFieldsPicker =
    options.join_field_picker_data?.join_field_options.length > 0;
  const showRelationsPicker =
    options.join_field_picker_data?.relation_options.length > 0;
  return (
    <Fragment>
      <i>
        <small>
          Previews shown in canvas are indicative based on random rows
        </small>
      </i>
      <table className="w-100">
        <tbody>
          <tr>
            <td>
              <label>Join field</label>
            </td>
            <td>
              <input
                id="inputjoin_field"
                type="text"
                className="form-control bg-white item-menu"
                name="join_field"
                data-fieldname="join_field"
                readOnly="readonly"
                value={name}
              />
            </td>
          </tr>

          <tr>
            <td colSpan="2">
              <div className="d-flex">
                {showFieldsPicker &&
                  buildFieldsMenu(options, setProp, refetchPreview)}
                {showRelationsPicker &&
                  buildRelationsMenu(
                    options,
                    setProp,
                    refetchPreview,
                    showFieldsPicker
                  )}
              </div>
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
                  className="form-control form-select"
                  onChange={(e) => {
                    if (!e.target) return;
                    const value = e.target.value;
                    setProp((prop) => (prop.fieldview = value));
                    refetchPreview({ fieldview: value });
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
      {cfgFields ? (
        <ConfigForm
          fields={cfgFields}
          configuration={configuration || {}}
          setProp={setProp}
          onChange={(k, v) => refetchPreview({ configuration: { [k]: v } })}
        />
      ) : null}
    </Fragment>
  );
};

/**
 * @type {object}
 */
JoinField.craft = {
  displayName: "JoinField",
  related: {
    settings: JoinFieldSettings,
    segment_type: "join_field",
    column_type: "JoinField",
    fields: [
      { name: "name", segment_name: "join_field", column_name: "join_field" },
      "fieldview",
      "textStyle",
      "block",
      { name: "configuration", default: {} },
    ],
  },
};
