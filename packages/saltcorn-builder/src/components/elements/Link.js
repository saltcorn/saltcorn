import React, { Fragment, useContext } from "react";
import { useNode } from "@craftjs/core";
import { blockProps, BlockSetting, TextStyleSetting, OrFormula } from "./utils";
import optionsCtx from "../context";

export const Link = ({ text, block, isFormula, textStyle }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <span
      className={`${textStyle} is-builder-link ${
        selected ? "selected-node" : ""
      } ${isFormula.text ? "text-monospace" : ""}`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
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
        {(options.views || []).length > 0 && <option>View</option>}
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
              <option value={`/view/${p.name}`}>{p.name}</option>
            ))}
          </select>
        </Fragment>
      )}
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
