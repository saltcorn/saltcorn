/**
 * @category saltcorn-builder
 * @module components/elements/Prompt
 * @subcategory components / elements
 */

import React, { useState, useContext, Fragment } from "react";
import { useNode, useEditor } from "@craftjs/core";
import useTranslation from "../../hooks/useTranslation";
import optionsCtx from "../context";
import StorageCtx from "../storage_context";

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
    id,
    parent,
  } = useNode((state) => ({
    selected: state.events.selected,
    parent: state.data.parent,
  }));

  const { query, actions: editorActions } = useEditor();
  const options = useContext(optionsCtx);
  const { layoutToNodes } = useContext(StorageCtx);
  const { t } = useTranslation();

  const [generating, setGenerating] = useState(false);

  const icon = PROMPT_ICONS[promptType] || "fas fa-robot";

  const handleGenerate = async (e) => {
    e.stopPropagation();
    if (!promptText.trim()) return;

    setGenerating(true);
    setProp((props) => {
      props.generateError = null;
    });

    try {
      const combinedPrompt = `[${promptType}]: ${promptText}`;

      const res = await fetch("/viewedit/copilot-generate-layout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CSRF-Token": options.csrfToken,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          prompt: combinedPrompt,
          mode: options.mode,
          table: options.tableName,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setProp((props) => {
          props.generateError = data.error;
        });
      } else if (data.layout) {
        editorActions.delete(id);
        layoutToNodes(data.layout, query, editorActions, parent, options);
      }
    } catch (err) {
      setProp((props) => {
        props.generateError = err.message || "Generation failed";
      });
    } finally {
      setGenerating(false);
    }
  };

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
        <span>{t("Prompt")}</span>
      </div>
      <textarea
        rows="3"
        className="form-control form-control-sm"
        style={{
          fontSize: "13px",
          backgroundColor: "transparent",
          border: "1px solid #b0c4de",
          resize: "vertical",
          marginBottom: "8px",
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
      <button
        className="btn btn-sm btn-success w-100"
        onClick={handleGenerate}
        disabled={generating || !promptText.trim()}
        style={{ fontSize: "12px" }}
      >
        {generating ? (
          <Fragment>
            <span
              className="spinner-border spinner-border-sm me-1"
              role="status"
            ></span>
            {t("Generating...")}
          </Fragment>
        ) : (
          <Fragment>
            <i className="fas fa-robot me-1"></i>
            {t("Generate")}
          </Fragment>
        )}
      </button>
    </div>
  );
};

const PromptSettings = () => {
  const { t } = useTranslation();
  const {
    actions: { setProp },
    promptType,
    promptText,
    generateError,
    id,
    parent,
  } = useNode((node) => ({
    promptType: node.data.props.promptType,
    promptText: node.data.props.promptText,
    generateError: node.data.props.generateError,
    id: node.id,
    parent: node.data.parent,
  }));

  const { query, actions: editorActions } = useEditor();
  const options = useContext(optionsCtx);
  const { layoutToNodes } = useContext(StorageCtx);

  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!promptText.trim()) return;

    setGenerating(true);
    setProp((props) => {
      props.generateError = null;
    });

    try {
      const combinedPrompt = `[${promptType}]: ${promptText}`;

      const res = await fetch("/viewedit/copilot-generate-layout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CSRF-Token": options.csrfToken,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          prompt: combinedPrompt,
          mode: options.mode,
          table: options.tableName,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setProp((props) => {
          props.generateError = data.error;
        });
      } else if (data.layout) {
        editorActions.delete(id);
        layoutToNodes(data.layout, query, editorActions, parent, options);
      }
    } catch (err) {
      setProp((props) => {
        props.generateError = err.message || "Generation failed";
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="mb-2">
        <label className="form-label">{t("Prompt")}</label>
        <textarea
          rows="4"
          className="form-control"
          value={promptText}
          placeholder={t("Describe what you want to generate...")}
          onChange={(e) =>
            setProp((props) => {
              props.promptText = e.target.value;
            })
          }
        />
        {generateError && (
          <div className="text-danger small mt-1">{generateError}</div>
        )}
      </div>
      <div className="mb-2">
        <button
          className="btn btn-sm btn-success w-100"
          onClick={handleGenerate}
          disabled={generating || !promptText.trim()}
        >
          {generating ? (
            <Fragment>
              <span
                className="spinner-border spinner-border-sm me-1"
                role="status"
              ></span>
              {t("Generating...")}
            </Fragment>
          ) : (
            <Fragment>
              <i className="fas fa-robot me-1"></i>
              {t("Generate")}
            </Fragment>
          )}
        </button>
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
