/**
 * @category saltcorn-builder
 * @module components/elements/MessageList
 * @subcategory components / elements
 */

import React from "react";
import useTranslation from "../../hooks/useTranslation";
import { useNode } from "@craftjs/core";
import { setAPropGen } from "./utils";

export /**
 * The list of messages in a Room view. The messages themselves are rendered by
 * the room's message show view, so this stands in for them on the canvas.
 *
 * @param {object} props
 * @param {string} props.height
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const MessageList = ({ height }) => {
  const { t } = useTranslation();
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));

  return (
    <div
      className={`sc-room-msglist-preview ${selected ? "selected-node" : ""}`}
      ref={(dom) => connect(drag(dom))}
      style={{
        border: "1px dashed #adb5bd",
        borderRadius: "0.25rem",
        padding: "0.5rem",
        minHeight: "5rem",
        maxHeight: height || undefined,
        overflowY: height ? "auto" : undefined,
      }}
    >
      <div className="text-muted small mb-1">
        {t("Messages")}
        {height ? ` (${t("scrolls")}: ${height})` : ""}
      </div>
      <div className="mb-1">{t("An earlier message")}</div>
      <div className="mb-1">{t("A reply to it")}</div>
      <div>{t("The most recent message")}</div>
    </div>
  );
};

export /**
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const MessageListSettings = () => {
  const { t } = useTranslation();
  const {
    actions: { setProp },
    height,
  } = useNode((node) => ({ height: node.data.props.height }));
  const setAProp = setAPropGen(setProp);

  return (
    <div>
      <label>{t("Height")}</label>
      <input
        type="text"
        className="form-control"
        value={height || ""}
        spellCheck={false}
        onChange={setAProp("height")}
      />
      <small className="text-muted">
        {t(
          "A CSS length, for example 400px or 60vh. The list scrolls within this height. Leave blank to grow with the page"
        )}
      </small>
    </div>
  );
};

/**
 * @type {object}
 */
MessageList.craft = {
  displayName: "MessageList",
  props: {
    height: "",
  },
  related: {
    settings: MessageListSettings,
    segment_type: "message_list",
    fields: [{ name: "height" }],
  },
};
