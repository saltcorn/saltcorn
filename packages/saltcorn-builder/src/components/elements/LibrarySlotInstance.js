/**
 * @category saltcorn-builder
 * @module components/elements/LibrarySlotInstance
 * @subcategory components / elements
 */

import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import useTranslation from "../../hooks/useTranslation";

export /**
 * A placeholder inside a shared Library component - each placement fills it
 * independently (picks a field to render, or drops its own content in),
 * without touching the shared component itself.
 * @param {object} props
 * @param {string} props.kind
 * @param {string} props.slot_name
 * @param {string} props.field
 * @param {string} props.fieldview
 * @param {*} props.children
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const LibrarySlotInstance = ({ kind, slot_name, field, fieldview, children }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const { t } = useTranslation();
  const isEmpty = Array.isArray(children) ? children.length === 0 : !children;

  return (
    <div
      ref={(dom) => connect(drag(dom))}
      className={`library-slot-instance ${
        kind === "field" ? "d-inline-block" : ""
      } ${selected ? "selected-node" : ""}`}
    >
      {kind === "field" ? (
        field ? (
          `[slot: ${fieldview || ""} ${field}]`
        ) : (
          `[slot: ${slot_name || "unfilled"}]`
        )
      ) : isEmpty ? (
        // an empty container slot has no size of its own to drop onto - a
        // placeholder gives it one, for both real users and drag targeting
        <div
          className="text-muted border border-dashed p-2"
          style={{ minHeight: "2em" }}
        >
          {t("Drop content here")}
        </div>
      ) : (
        children
      )}
    </div>
  );
};

export /**
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const LibrarySlotInstanceSettings = () => {
  const {
    actions: { setProp },
    slot_name,
    kind,
    field,
    fieldview,
  } = useNode((node) => ({
    slot_name: node.data.props.slot_name,
    kind: node.data.props.kind,
    field: node.data.props.field,
    fieldview: node.data.props.fieldview,
  }));
  const { t } = useTranslation();
  const options = useContext(optionsCtx);
  const canPickField = !!options.fields;
  const fvs = (options.field_view_options || {})[field];

  return (
    <div>
      <label>{t("Slot name")}</label>
      <input
        type="text"
        className="slot-name form-control"
        value={slot_name || ""}
        onChange={(e) => {
          if (!e.target) return;
          const value = e.target.value;
          setProp((prop) => (prop.slot_name = value));
        }}
      />
      <label className="mt-2">{t("Kind")}</label>
      <select
        className="slot-kind form-control form-select"
        value={kind}
        onChange={(e) => {
          if (!e.target) return;
          const value = e.target.value;
          setProp((prop) => (prop.kind = value));
        }}
      >
        <option value="field" disabled={!canPickField}>
          {t("Field")}
        </option>
        <option value="container">{t("Container")}</option>
      </select>
      {!canPickField && kind === "field" && (
        <small className="text-muted d-block mt-1">
          {t(
            "Field slots aren't available here - this builder isn't bound to one table."
          )}
        </small>
      )}
      {kind === "field" && canPickField ? (
        <table className="w-100 mt-2">
          <tbody>
            <tr>
              <td>
                <label>{t("Field")}</label>
              </td>
              <td>
                <select
                  className="field form-control form-select"
                  value={field || ""}
                  onChange={(e) => {
                    if (!e.target) return;
                    const value = e.target.value;
                    setProp((prop) => (prop.field = value));
                    const newfvs = options.field_view_options[value];
                    if (newfvs && newfvs.length > 0)
                      setProp((prop) => (prop.fieldview = newfvs[0]));
                  }}
                >
                  <option value="">{t("Choose a field")}</option>
                  {options.fields.map((f, ix) => (
                    <option key={ix} value={f.name}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
            {fvs && (
              <tr>
                <td>
                  <label>{t("Field view")}</label>
                </td>
                <td>
                  <select
                    className="fieldview form-control form-select"
                    value={fieldview || ""}
                    onChange={(e) => {
                      if (!e.target) return;
                      const value = e.target.value;
                      setProp((prop) => (prop.fieldview = value));
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
          </tbody>
        </table>
      ) : null}
      {kind === "container" && (
        <small className="text-muted d-block mt-2">
          {t(
            "Drop elements here - each placement of this component fills this area independently."
          )}
        </small>
      )}
    </div>
  );
};

/**
 * @type {object}
 */
LibrarySlotInstance.craft = {
  displayName: "LibrarySlotInstance",
  // declared here rather than relying on every caller to wrap it in
  // <Element canvas> - Library.js's onNodesChange creates it bare
  isCanvas: true,
  props: {
    slot_name: "",
    kind: "field",
    field: undefined,
    fieldview: undefined,
  },
  rules: {
    canDrag: () => true,
    // a field slot has no children - it's filled via the settings panel,
    // not by dropping elements into it
    canMoveIn: (incoming, currentNode) =>
      currentNode?.data?.props?.kind !== "field",
  },
  related: {
    settings: LibrarySlotInstanceSettings,
  },
};
