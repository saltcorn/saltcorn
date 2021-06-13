import React from "react";
import { useNode } from "@craftjs/core";
import {
  blockProps,
  BlockSetting,
  SettingsFromFields,
  TextStyleSetting,
} from "./utils";

export const HTMLCode = ({ text }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <span
      className={`is-html-block ${selected ? "selected-node" : ""}`}
      ref={(dom) => connect(drag(dom))}
    >
      <div style={{ fontSize: "8px" }}>HTML</div>
      <div dangerouslySetInnerHTML={{ __html: text }}></div>
    </span>
  );
};

export const HTMLCodeSettings = () => {
  const {
    actions: { setProp },
    text,
  } = useNode((node) => ({
    text: node.data.props.text,
  }));
  return (
    <div>
      <label>HTML code</label>
      <textarea
        rows="6"
        type="text"
        className="text-to-display w-100"
        value={text}
        onChange={(e) => setProp((prop) => (prop.text = e.target.value))}
      ></textarea>
    </div>
  );
};
const fields = [
  {
    label: "HTML Code",
    name: "text",
    type: "textarea",
    segment_name: "contents"
  },
];

HTMLCode.craft = {
  displayName: "HTMLCode",
  related: {
    settings: SettingsFromFields(fields),
    segment_type: "blank",
    segment_vars: { isHTML: true },
    segment_match: (segment) => segment.isHtml,
    fields,
  },
};
