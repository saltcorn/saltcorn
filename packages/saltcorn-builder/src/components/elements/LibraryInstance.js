/**
 * @category saltcorn-builder
 * @module components/elements/LibraryInstance
 * @subcategory components / elements
 */

import React from "react";
import { useNode } from "@craftjs/core";
import useTranslation from "../../hooks/useTranslation";

// A placed copy of a shared Library component - edits here save back to the
// shared component, so every other page using it updates too.
export /**
 * @param {object} props
 * @param {*} props.children
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const LibraryInstance = ({ children }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));

  // a real box (not display:contents) so drops can actually be targeted
  // inside it - display:contents has no geometry, so the builder's own
  // drop-position hit-testing skips straight past it to its parent
  return (
    <div
      ref={(dom) => connect(drag(dom))}
      className={`library-instance ${selected ? "selected-node" : ""}`}
    >
      {children}
    </div>
  );
};

export /**
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const LibraryInstanceSettings = () => {
  const { library_name } = useNode((node) => ({
    library_name: node.data.props.library_name,
  }));
  const { t } = useTranslation();
  return (
    <div>
      <p>
        {t("Shared component")}: <strong>{library_name}</strong>
      </p>
      <small className="text-muted d-block">
        {t(
          "Editing its contents changes every page and view that uses it."
        )}
      </small>
    </div>
  );
};

/**
 * @type {object}
 */
LibraryInstance.craft = {
  displayName: "LibraryInstance",
  // declared here rather than relying on every caller to wrap it in
  // <Element canvas> - some (eg Library.js's addSelected) create it bare
  isCanvas: true,
  props: {
    library_id: undefined,
    library_name: "",
  },
  rules: {
    canDrag: () => true,
  },
  related: {
    settings: LibraryInstanceSettings,
  },
};
