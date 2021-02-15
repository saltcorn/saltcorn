import React, { Fragment, useContext } from "react";
import { useNode } from "@craftjs/core";
import { blockProps, BlockSetting, TextStyleSetting, OrFormula } from "./utils";
import optionsCtx from "../context";
import FontIconPicker from "@fonticonpicker/react-fonticonpicker";
import faIcons from "./faicons";

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
  return (
    <div>
      <label>Text to display</label>
      <OrFormula nodekey="text" {...{ setProp, isFormula, node }}>
        <input
          type="text"
          className="form-control text-to-display"
          value={text}
          onChange={(e) => setProp((prop) => (prop.text = e.target.value))}
        />
      </OrFormula>
      <label>Link source</label>
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
        {(options.views || []).length > 0 && options.mode === "page" && (
          <option>View</option>
        )}
      </select>
      {link_src === "URL" && (
        <Fragment>
          {" "}
          <label>URL</label>
          <OrFormula nodekey="url" {...{ setProp, isFormula, node }}>
            <input
              type="text"
              className="form-control "
              value={url}
              onChange={(e) => setProp((prop) => (prop.url = e.target.value))}
            />
          </OrFormula>
        </Fragment>
      )}
      {link_src === "Page" && (
        <Fragment>
          {" "}
          <label>Page</label>
          <select
            value={url}
            className="form-control"
            onChange={(e) =>
              setProp((prop) => {
                prop.url = e.target.value;
              })
            }
          >
            <option></option>
            {(options.pages || []).map((p) => (
              <option value={`/page/${p.name}`}>{p.name}</option>
            ))}
          </select>
        </Fragment>
      )}
      {link_src === "View" && (
        <Fragment>
          {" "}
          <label>View</label>
          <select
            value={url}
            className="form-control"
            onChange={(e) =>
              setProp((prop) => {
                prop.url = e.target.value;
              })
            }
          >
            <option></option>
            {(options.views || []).map((p) => (
              <option value={`/view/${p.name}`}>
                {p.name} [{p.viewtemplate}]
              </option>
            ))}
          </select>
        </Fragment>
      )}
      <div>
        <label>Link style</label>
        <select
          className="form-control"
          value={link_style}
          onChange={(e) =>
            setProp((prop) => (prop.link_style = e.target.value))
          }
        >
          <option value="">Link</option>
          <option value="btn btn-primary">Primary button</option>
          <option value="btn btn-secondary">Secondary button</option>
          <option value="btn btn-success">Success button</option>
          <option value="btn btn-danger">Danger button</option>
          <option value="btn btn-outline-primary">
            Primary outline button
          </option>
          <option value="btn btn-outline-secondary">
            Secondary outline button
          </option>
        </select>
      </div>
      <div>
        <label>Link size</label>
        <select
          className="form-control"
          value={link_size}
          onChange={(e) => setProp((prop) => (prop.link_size = e.target.value))}
        >
          <option value="">Standard</option>
          <option value="btn-lg">Large</option>
          <option value="btn-sm">Small</option>
          <option value="btn-block">Block</option>
          <option value="btn-block btn-lg">Large block</option>
        </select>
      </div>
      <label className="mr-2">Icon</label>
      <FontIconPicker
        value={link_icon}
        icons={faIcons}
        onChange={(value) => setProp((prop) => (prop.link_icon = value))}
        isMulti={false}
      />
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
  },
};
