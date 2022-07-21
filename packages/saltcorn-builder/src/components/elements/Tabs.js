/**
 * @category saltcorn-builder
 * @module components/elements/Tabs
 * @subcategory components / elements
 */

import React, { Fragment, useState, useContext, useEffect } from "react";
import { ntimes } from "./Columns";
import { Column } from "./Column";
import optionsCtx from "../context";
import { setAPropGen } from "./utils";

import { Element, useNode } from "@craftjs/core";

export /**
 * @param {object} props
 * @param {string[]} props.contents
 * @param {string[]} props.titles
 * @param {string} props.tabsStyle
 * @param {number} props.ntabs
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const Tabs = ({ contents, titles, tabsStyle, ntabs, independent, field }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const [showTab, setShowTab] = useState(0);
  const [showTabs, setShowTabs] = useState([true]);
  if (tabsStyle === "Accordion")
    return (
      <div className="accordion">
        {ntimes(ntabs, (ix) => (
          <div key={ix} className="card">
            <div className="card-header">
              <h2 className="mb-0">
                <button
                  className="btn btn-link btn-block text-left"
                  type="button"
                  onClick={() => {
                    setShowTab(ix);
                    if (!independent) {
                      let newArr = [];
                      newArr[ix] = true;
                      setShowTabs(newArr);
                    } else {
                      let newArr = [...showTabs];
                      newArr[ix] = !newArr[ix];
                      setShowTabs(newArr);
                    }
                  }}
                >
                  {titles[ix]}
                </button>
              </h2>
            </div>

            <div
              id={`collapse${ix}`}
              className={`collapse ${
                (independent && showTabs[ix]) || (!independent && showTab == ix)
                  ? "show"
                  : ""
              }`}
              aria-labelledby="headingOne"
              data-parent="#accordionExample"
            >
              <div className="card-body">
                <Element canvas id={`Tab${ix}`} is={Column}>
                  {contents[ix]}
                </Element>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  else
    return (
      <Fragment>
        <ul
          id="myTab"
          role="tablist"
          className={`nav ${
            tabsStyle === "Tabs" ? "nav-tabs" : "nav-pills"
          } builder ${selected ? "selected-node" : ""}`}
          ref={(dom) => connect(drag(dom))}
        >
          {ntimes(ntabs, (ix) => {
            if (!titles[ix]) return null;
            const targetIx =
              typeof titles[ix].value === "undefined" ? ix : titles[ix].value;
            return (
              <li key={ix} className="nav-item" role="presentation">
                <a
                  className={`nav-link ${targetIx === showTab ? `active` : ""}`}
                  onClick={() => setShowTab(targetIx)}
                >
                  {titles[ix] &&
                    (typeof titles[ix].label === "undefined"
                      ? titles[ix]
                      : titles[ix].label === ""
                      ? "(empty)"
                      : titles[ix].label)}
                </a>
              </li>
            );
          })}
        </ul>
        <div className="tab-content" id="myTabContent">
          {ntimes(ntabs, (ix) => {
            if (!titles[ix]) return null;

            const useIx =
              typeof titles[ix].value === "undefined" ? ix : titles[ix].value;

            if (useIx !== showTab)
              return (
                <div className="d-none" key={ix}>
                  <Element canvas id={`Tab${useIx}`} is={Column}>
                    {contents[useIx]}
                  </Element>
                </div>
              );
            //d-none display of useIx is bug workaround? needed
            else
              return (
                <div
                  key={ix}
                  className={`tab-pane fade ${
                    useIx === showTab ? `show active` : ""
                  }`}
                  role="tabpanel"
                  aria-labelledby="home-tab"
                >
                  <div className="d-none">{useIx}</div>
                  <Element canvas id={`Tab${useIx}`} is={Column}>
                    {contents[useIx]}
                  </Element>
                </div>
              );
          })}
        </div>
      </Fragment>
    );
};

export /**
 * @returns {table}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const TabsSettings = () => {
  const node = useNode((node) => ({
    tabsStyle: node.data.props.tabsStyle,
    ntabs: node.data.props.ntabs,
    independent: node.data.props.independent,
    deeplink: node.data.props.deeplink,
    titles: node.data.props.titles,
    field: node.data.props.field,
  }));
  const {
    actions: { setProp },
    titles,
    tabsStyle,
    deeplink,
    independent,
    ntabs,
    field,
  } = node;
  const options = useContext(optionsCtx);
  useEffect(() => {
    if (field)
      fetch(`/api/${options.tableName}/distinct/${field}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "CSRF-Token": options.csrfToken,
        },
      })
        .then(function (response) {
          if (response.status < 399) return response.json();
          else return "";
        })
        .then(function (data) {
          if (data.success) {
            const len = data.success.length;

            setProp((prop) => (prop.ntabs = len));
            setProp((prop) => (prop.titles = data.success));
          }
        });
  }, [field]);
  const setAProp = setAPropGen(setProp);

  return (
    <table className="w-100" accordiontitle="Placement">
      <tbody>
        <tr>
          <th>
            <label>Style</label>
          </th>
          <td>
            <select
              value={tabsStyle}
              className="form-control form-select"
              onChange={setAProp("tabsStyle")}
            >
              <option>Tabs</option>
              <option>Pills</option>
              <option>Accordion</option>
              {["show", "edit"].includes(options.mode) && (
                <option>Value switch</option>
              )}
            </select>
          </td>
        </tr>
        {tabsStyle === "Value switch" ? (
          <tr>
            <td>
              <label>Field</label>
            </td>
            <td>
              <select
                value={field}
                className="form-control form-select"
                onChange={setAProp("field")}
              >
                {options.fields.map((f, ix) => (
                  <option key={ix} value={f.name}>
                    {f.label}
                  </option>
                ))}
              </select>
            </td>
          </tr>
        ) : (
          <Fragment>
            <tr>
              <th>
                <label>Number of sections</label>
              </th>
              <td>
                <input
                  type="number"
                  className="form-control"
                  value={ntabs}
                  step="1"
                  min="0"
                  max="20"
                  onChange={setAProp("ntabs")}
                />
              </td>
            </tr>
            <tr>
              <th colSpan="2">Titles</th>
            </tr>
            {ntimes(ntabs, (ix) => (
              <tr key={ix}>
                <th>{ix + 1}</th>
                <td>
                  <input
                    type="text"
                    className="form-control text-to-display"
                    value={titles[ix]}
                    onChange={(e) => {
                      if (!e.target) return;
                      const value = e.target.value;
                      setProp((prop) => (prop.titles[ix] = value));
                    }}
                  />
                </td>
              </tr>
            ))}
            {tabsStyle === "Accordion" ? (
              <tr>
                <td colSpan="2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      name="block"
                      type="checkbox"
                      checked={independent}
                      onChange={setAProp("independent", { checked: true })}
                    />
                    <label className="form-check-label">
                      Open independently
                    </label>
                  </div>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan="2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      name="block"
                      type="checkbox"
                      checked={deeplink}
                      onChange={setAProp("deeplink", { checked: true })}
                    />
                    <label className="form-check-label">Deep link</label>
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        )}
      </tbody>
    </table>
  );
};

/**
 * @type {object}
 */
Tabs.craft = {
  props: {
    titles: ["Tab1", "Tab2"],
    ntabs: 2,
    tabsStyle: "Tabs",
    independent: false,
    deeplink: true,
  },
  displayName: "Tabs",
  related: {
    settings: TabsSettings,
  },
};
