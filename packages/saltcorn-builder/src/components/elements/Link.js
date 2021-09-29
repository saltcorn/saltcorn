import React, { Fragment, useContext } from "react";
import { useNode } from "@craftjs/core";
import {
  blockProps,
  BlockSetting,
  TextStyleSetting,
  OrFormula,
  ButtonOrLinkSettingsRows,
} from "./utils";
import optionsCtx from "../context";

export const Link = ({
  text,
  block,
  isFormula,
  textStyle,
  link_style,
  link_size,
  link_icon,
}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <span
      className={`${textStyle} is-builder-link ${
        selected ? "selected-node" : ""
      } ${isFormula.text ? "text-monospace" : ""} ${link_style} ${link_size}`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
      {link_icon ? <i className={`${link_icon} mr-1`}></i> : ""}
      {isFormula.text ? `=${text}` : text}
    </span>
  );
};

export const LinkSettings = () => {
  const node = useNode((node) => ({
    text: node.data.props.text,
    url: node.data.props.url,
    block: node.data.props.block,
    isFormula: node.data.props.isFormula,
    textStyle: node.data.props.textStyle,
    nofollow: node.data.props.nofollow,
    link_src: node.data.props.link_src,
    target_blank: node.data.props.target_blank,
    link_style: node.data.props.link_style,
    link_size: node.data.props.link_size,
    link_icon: node.data.props.link_icon,
  }));
  const {
    actions: { setProp },
    text,
    url,
    block,
    isFormula,
    textStyle,
    nofollow,
    target_blank,
    link_src,
    link_style,
    link_size,
    link_icon,
  } = node;
  const options = useContext(optionsCtx);
  const setAProp = (key) => (e) => {
    if (e.target) {
      const target_value = e.target.value;
      setProp((prop) => (prop[key] = target_value));
    }
  };
  return (
    <div>
      <table className="w-100">
        <tbody>
          <tr>
            <td>
              <label>Text to display</label>
            </td>
            <td>
              <OrFormula nodekey="text" {...{ setProp, isFormula, node }}>
                <input
                  type="text"
                  className="form-control text-to-display"
                  value={text}
                  onChange={setAProp("text")}
                />
              </OrFormula>
            </td>
          </tr>
          <tr>
            <td>
              <label>Link source</label>
            </td>
            <td>
              <select
                value={link_src}
                className="form-control"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.link_src = e.target.value;
                    if (e.target.value !== "URL") {
                      prop.isFormula.url = false;
                    }
                  })
                }
              >
                <option>URL</option>
                {(options.pages || []).length > 0 && <option>Page</option>}
                {(options.views || []).length > 0 &&
                  options.mode === "page" && <option>View</option>}
              </select>
            </td>
          </tr>
          {link_src === "URL" && (
            <tr>
              <td>
                <label>URL</label>
              </td>
              <td>
                <OrFormula nodekey="url" {...{ setProp, isFormula, node }}>
                  <input
                    type="text"
                    className="form-control "
                    value={url}
                    onChange={setAProp("url")}
                  />
                </OrFormula>
              </td>
            </tr>
          )}
          {link_src === "Page" && (
            <tr>
              <td>
                <label>Page</label>
              </td>
              <td>
                <select
                  value={url}
                  className="form-control"
                  onChange={setAProp("url")}
                >
                  <option></option>
                  {(options.pages || []).map((p) => (
                    <option value={`/page/${p.name}`}>{p.name}</option>
                  ))}
                </select>
              </td>
            </tr>
          )}
          {link_src === "View" && (
            <tr>
              <td>
                <label>View</label>
              </td>
              <td>
                <select
                  value={url}
                  className="form-control"
                  onChange={setAProp("url")}
                >
                  <option></option>
                  {(options.views || []).map((p) => (
                    <option value={`/view/${p.name}`}>
                      {p.name} [{p.viewtemplate}]
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          )}
          <ButtonOrLinkSettingsRows
            setProp={setProp}
            keyPrefix="link_"
            btnClass="btn"
            values={node}
            linkFirst={true}
          />
        </tbody>
      </table>

      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={nofollow}
          onChange={(e) =>
            setProp((prop) => (prop.nofollow = e.target.checked))
          }
        />
        <label className="form-check-label">Nofollow</label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={target_blank}
          onChange={(e) =>
            setProp((prop) => (prop.target_blank = e.target.checked))
          }
        />
        <label className="form-check-label">Open in new tab</label>
      </div>
      <BlockSetting block={block} setProp={setProp} />
      <TextStyleSetting textStyle={textStyle} setProp={setProp} />
    </div>
  );
};

Link.craft = {
  defaultProps: {
    text: "Click here",
    url: "https://saltcorn.com/",
    block: false,
    nofollow: false,
    target_blank: false,
    isFormula: {},
    textStyle: "",
    link_src: "URL",
  },
  displayName: "Link",
  related: {
    settings: LinkSettings,
    segment_type: "link",
    fields: [
      { name: "text", canBeFormula: true },
      { name: "url", canBeFormula: true },
      { name: "link_src", default: "URL" },
      "block",
      "nofollow",
      "target_blank",
      "textStyle",
      "link_size",
      "link_icon",
      "link_style",
    ],
  },
};
