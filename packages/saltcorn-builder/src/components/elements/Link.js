/**
 * @category saltcorn-builder
 * @module components/elements/Link
 * @subcategory components / elements
 */

import React, { Fragment, useContext } from "react";
import { useNode } from "@craftjs/core";
import {
  blockProps,
  BlockSetting,
  TextStyleSetting,
  OrFormula,
  ButtonOrLinkSettingsRows,
  DynamicFontAwesomeIcon,
  setAPropGen,
} from "./utils";
import optionsCtx from "../context";

export /**
 * @param {object} props
 * @param {string} props.text
 * @param {boolean} props.block
 * @param {object} props.isFormula
 * @param {string} props.textStyle
 * @param {string} props.link_style
 * @param {string} props.link_size
 * @param {string} [props.link_icon]
 * @param {string} [props.link_bgcol]
 * @param {string} [props.link_bordercol]
 * @param {string} [props.link_textcol]
 * @returns {Fragment}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const Link = ({
  text,
  block,
  isFormula,
  textStyle,
  link_style,
  link_size,
  link_icon,
  link_bgcol,
  link_bordercol,
  link_textcol,
}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  if (!link_style)
    return (
      <span
        className={`${textStyle} is-builder-link ${
          selected ? "selected-node" : ""
        } ${isFormula?.text ? "font-monospace" : ""} ${block ? "d-block" : ""}`}
        ref={(dom) => connect(drag(dom))}
      >
        <DynamicFontAwesomeIcon icon={link_icon} className="me-1" />
        {isFormula?.text ? `=${text}` : text}
      </span>
    );
  else
    return (
      <button
        className={`${textStyle} is-builder-link ${
          selected ? "selected-node" : ""
        } ${isFormula?.text ? "font-monospace" : ""} ${link_style} ${
          link_size || ""
        } ${block ? "d-block" : ""}`}
        ref={(dom) => connect(drag(dom))}
        style={
          link_style === "btn btn-custom-color"
            ? {
                backgroundColor: link_bgcol || "#000000",
                borderColor: link_bordercol || "#000000",
                color: link_textcol || "#000000",
              }
            : {}
        }
      >
        <DynamicFontAwesomeIcon icon={link_icon} className="me-1" />
        {isFormula?.text ? `=${text}` : text}
      </button>
    );
};

export /**
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const LinkSettings = () => {
  const node = useNode((node) => ({
    text: node.data.props.text,
    url: node.data.props.url,
    block: node.data.props.block,
    isFormula: node.data.props.isFormula,
    textStyle: node.data.props.textStyle,
    nofollow: node.data.props.nofollow,
    in_modal: node.data.props.in_modal,
    view_state_fml: node.data.props.view_state_fml,
    link_src: node.data.props.link_src,
    target_blank: node.data.props.target_blank,
    link_style: node.data.props.link_style,
    link_size: node.data.props.link_size,
    link_title: node.data.props.link_title,
    link_class: node.data.props.link_class,
    link_icon: node.data.props.link_icon,
    link_bgcol: node.data.props.link_bgcol,
    link_bordercol: node.data.props.link_bordercol,
    link_textcol: node.data.props.link_textcol,
    transfer_state: node.data.props.transfer_state,
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
    in_modal,
    transfer_state,
    view_state_fml,
  } = node;
  const options = useContext(optionsCtx);
  const setAProp = setAPropGen(setProp);
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
                className="form-control form-select"
                onChange={(e) => {
                  if (!e.target) return;
                  const value = e.target.value;
                  setProp((prop) => {
                    prop.link_src = value;
                    if (value !== "URL" && prop.isFormula) {
                      prop.isFormula.url = false;
                    }
                  });
                }}
              >
                <option>URL</option>
                {(options.pages || []).length > 0 && <option>Page</option>}
                {(options.views || []).length > 0 &&
                  ["page", "filter"].includes(options.mode) && (
                    <option>View</option>
                  )}
                {(options.page_groups || []).length > 0 && (
                  <option>Page Group</option>
                )}
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
                    spellCheck={false}
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
                  className="form-control form-select"
                  onChange={setAProp("url")}
                >
                  <option></option>
                  {(options.pages || []).map((p, ix) => (
                    <option key={ix} value={`/page/${p.name}`}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          )}
          {link_src === "Page Group" && (
            <tr>
              <td>
                <label>Page Group</label>
              </td>
              <td>
                <select
                  value={url}
                  className="form-control form-select"
                  onChange={setAProp("url")}
                >
                  <option></option>
                  {(options.page_groups || []).map((p, ix) => (
                    <option key={ix} value={`/page/${p.name}`}>
                      {p.name}
                    </option>
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
                  className="form-control form-select"
                  onChange={setAProp("url")}
                >
                  <option></option>
                  {(options.views || []).map((p, ix) => (
                    <option key={ix} value={`/view/${p.name}`}>
                      {p.name} [{p.viewtemplate}]
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          )}
          {link_src === "View" && (
            <tr>
              <td>
                <label>State Formula</label>
              </td>
              <td>
                <input
                  type="text"
                  spellCheck={false}
                  className="form-control"
                  value={view_state_fml}
                  onChange={setAProp("view_state_fml")}
                />
              </td>
            </tr>
          )}
          <ButtonOrLinkSettingsRows
            setProp={setProp}
            keyPrefix="link_"
            btnClass="btn"
            values={node}
            linkFirst={true}
            linkIsBlank={true}
            allowRunOnLoad={false}
            faIcons={options.icons}
          />
        </tbody>
      </table>

      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={nofollow}
          onChange={setAProp("nofollow", { checked: true })}
        />
        <label className="form-check-label">Nofollow</label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={target_blank}
          onChange={setAProp("target_blank", { checked: true })}
        />
        <label className="form-check-label">Open in new tab</label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={in_modal}
          onChange={setAProp("in_modal", { checked: true })}
        />
        <label className="form-check-label">Open in popup modal?</label>
      </div>

      {["filter", "page"].includes(options.mode) && (
        <div className="form-check">
          <input
            className="form-check-input"
            name="block"
            type="checkbox"
            checked={transfer_state}
            onChange={setAProp("transfer_state", { checked: true })}
          />
          <label className="form-check-label">Transfer state</label>
        </div>
      )}

      <BlockSetting block={block} setProp={setProp} />
      <TextStyleSetting textStyle={textStyle} setProp={setProp} />
      <table>
        <tbody>
          {(link_src === "Page" && url && url.startsWith("/page/")) ||
          (link_src === "View" && url && url.startsWith("/view/")) ? (
            <tr>
              <td colSpan="2">
                <a
                  className="d-block mt-2"
                  target="_blank"
                  href={
                    link_src === "Page"
                      ? url.replace("/page/", `/pageedit/edit/`)
                      : link_src === "View"
                        ? url.replace("/view/", `/viewedit/config/`)
                        : ""
                  }
                >
                  Configure this {link_src}
                </a>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};

/**
 * @type {object}
 */
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
      "link_title",
      "link_class",
      "link_bgcol",
      "link_bordercol",
      "link_textcol",
      "in_modal",
      "transfer_state",
      "view_state_fml",
    ],
  },
};
