/**
 * @category saltcorn-builder
 * @module components/elements/Prompt
 * @subcategory components / elements
 */

import React from "react";
import { useNode } from "@craftjs/core";
import useTranslation from "../../hooks/useTranslation";

const PROMPT_ICONS = {
  container: "fas fa-box",
  view: "fas fa-eye",
  field: "fas fa-i-cursor",
  action: "fas fa-bolt",
};

const PROMPT_LABELS = {
  container: "Container",
  view: "View",
  field: "Field",
  action: "Action",
};

export const Prompt = ({ promptType, promptText }) => {
  const {
    connectors: { connect, drag },
    selected,
    actions: { setProp },
  } = useNode((state) => ({
    selected: state.events.selected,
  }));

  const { t } = useTranslation();
  const icon = PROMPT_ICONS[promptType] || "fas fa-robot";
  const label = PROMPT_LABELS[promptType] || "Prompt";

  return (
    <div
      ref={(dom) => connect(drag(dom))}
      className={`prompt-placeholder ${selected ? "selected-node" : ""}`}
      style={{
        border: "2px dashed #6c8ebf",
        borderRadius: "8px",
        padding: "12px",
        margin: "4px 0",
        backgroundColor: "#e8f0fe",
        minHeight: "60px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "6px",
          fontWeight: "bold",
          fontSize: "13px",
          color: "#1a73e8",
        }}
      >
        <i className={icon}></i>
        <span>
          {t("Prompt")} ({t(label)})
        </span>
      </div>
      <textarea
        rows="3"
        className="form-control form-control-sm"
        style={{
          fontSize: "13px",
          backgroundColor: "transparent",
          border: "1px solid #b0c4de",
          resize: "vertical",
        }}
        value={promptText}
        placeholder={t("Describe what you want to generate...")}
        onChange={(e) =>
          setProp((props) => {
            props.promptText = e.target.value;
          })
        }
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

const PromptSettings = () => {
  const { t } = useTranslation();
  const {
    promptType,
    promptText,
  } = useNode((node) => ({
    promptType: node.data.props.promptType,
    promptText: node.data.props.promptText,
  }));

  return (
    <div>
      <div className="mb-2">
        <label className="form-label fw-bold">
          {t("Type")}: {t(PROMPT_LABELS[promptType] || "Prompt")}
        </label>
      </div>
      <div className="mb-2">
        <label className="form-label text-muted small">
          {promptText
            ? t("Edit the prompt directly in the canvas")
            : t("Click the prompt in the canvas to type")}
        </label>
      </div>
    </div>
  );
};

Prompt.craft = {
  displayName: "Prompt",
  defaultProps: {
    promptType: "container",
    promptText: "",
  },
  related: {
    settings: PromptSettings,
    segment_type: "prompt",
    fields: ["promptType", "promptText"],
  },
};
