/**
 * @category saltcorn-builder
 * @module components/elements/MessageForm
 * @subcategory components / elements
 */

import React from "react";
import useTranslation from "../../hooks/useTranslation";
import { useNode } from "@craftjs/core";
import { setAPropGen } from "./utils";

export /**
 * The form for sending a new message. Its fields come from the room's message
 * form view, so this stands in for it on the canvas.
 *
 * @param {object} props
 * @param {boolean} props.pinned
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const MessageForm = ({ pinned }) => {
  const { t } = useTranslation();
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));

  return (
    <div
      className={`sc-room-msgform-preview ${selected ? "selected-node" : ""}`}
      ref={(dom) => connect(drag(dom))}
    >
      <div className="input-group">
        <input
          type="text"
          className="form-control bg-light"
          placeholder={t("New message...")}
          readOnly={true}
        />
        <button className="btn btn-primary" disabled>
          {t("Send")}
        </button>
      </div>
      {pinned && (
        <div className="text-muted small">{t("Pinned below the messages")}</div>
      )}
    </div>
  );
};

export /**
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const MessageFormSettings = () => {
  const { t } = useTranslation();
  const {
    actions: { setProp },
    pinned,
  } = useNode((node) => ({ pinned: node.data.props.pinned }));
  const setAProp = setAPropGen(setProp);

  return (
    <div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="pinned"
          type="checkbox"
          checked={!!pinned}
          onChange={setAProp("pinned", { checked: true })}
        />
        <label className="form-check-label">{t("Pin to bottom")}</label>
      </div>
      <small className="text-muted">
        {t(
          "Fix the form below the message list, which then scrolls within the room. The room takes the message list height, or fills the window down to the bottom if that is blank"
        )}
      </small>
    </div>
  );
};

/**
 * @type {object}
 */
MessageForm.craft = {
  displayName: "MessageForm",
  props: {
    pinned: false,
  },
  related: {
    settings: MessageFormSettings,
    segment_type: "message_form",
    fields: [{ name: "pinned" }],
  },
};
