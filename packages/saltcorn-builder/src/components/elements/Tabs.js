/**
 * @category saltcorn-builder
 * @module components/elements/Tabs
 * @subcategory components / elements
 */

import React, { Fragment, useState, useContext, useEffect } from "react";
import { ntimes } from "./Columns";
import { Column } from "./Column";
import optionsCtx from "../context";
import { setAPropGen, buildOptions, ConfigField } from "./utils";
import { ArrayManager } from "./ArrayManager";

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
const Tabs = ({
  contents,
  titles,
  tabsStyle,
  ntabs,
  independent,
  startClosed,
  field,
  setting_tab_n,
}) => {
  const {
    selected,
    connectors: { connect, drag },
    actions: { setProp },
  } = useNode((node) => ({ selected: node.events.selected }));

  const showTab = setting_tab_n;
  const setShowTab = (n) => setProp((prop) => (prop.setting_tab_n = n));
  const [showTabs, setShowTabs] = useState(
    tabsStyle === "Accordion" && startClosed ? [] : [true]
  );
  if (tabsStyle === "Accordion")
    return (
      <div
        className={`accordion ${selected ? "selected-node" : ""}`}
        ref={(dom) => connect(drag(dom))}
      >
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
    startClosed: node.data.props.startClosed,
    deeplink: node.data.props.deeplink,
    disable_inactive: node.data.props.disable_inactive,
    serverRendered: node.data.props.serverRendered,
    setting_tab_n: node.data.props.setting_tab_n,
    tabId: node.data.props.tabId,
    titles: node.data.props.titles,
    showif: node.data.props.showif,
    field: node.data.props.field,
    acc_init_opens: node.data.props.acc_init_opens,
    contents: node.data.props.contents,
  }));
  const {
    actions: { setProp },
    titles,
    tabsStyle,
    deeplink,
    disable_inactive,
    independent,
    startClosed,
    ntabs,
    field,
    serverRendered,
    tabId,
    showif,
    setting_tab_n,
    acc_init_opens,
  } = node;
  const use_setting_tab_n = setting_tab_n || 0;
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
  const styleOptions = ["Tabs", "Pills", "Accordion"];
  if (["show", "edit"].includes(options.mode))
    styleOptions.push("Value switch");

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
              {buildOptions(styleOptions)}
            </select>
          </td>
        </tr>
        {tabsStyle === "Value switch" ? (
          <Fragment>
            <tr>
              <td>
                <label>Field</label>
              </td>
              <td>
                <select
                  value={field}
                  className="field form-control form-select"
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
          </Fragment>
        ) : (
          <Fragment>
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
              <Fragment>
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
                <tr>
                  <td colSpan="2">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        name="block"
                        type="checkbox"
                        checked={serverRendered}
                        onChange={setAProp("serverRendered", { checked: true })}
                      />
                      <label className="form-check-label">
                        Server rendering
                      </label>
                    </div>
                  </td>
                </tr>
                {serverRendered ? (
                  <tr>
                    <th>
                      <label>Identifier</label>
                    </th>
                    <td>
                      <input
                        type="text"
                        spellCheck={false}
                        className="form-control"
                        value={tabId}
                        onChange={setAProp("tabId")}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )}
            {tabsStyle === "Accordion" ? (
              <tr>
                <td colSpan="2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      name="block"
                      type="checkbox"
                      checked={startClosed}
                      onChange={setAProp("startClosed", { checked: true })}
                    />
                    <label className="form-check-label">
                      Inititally closed
                    </label>
                  </div>
                </td>
              </tr>
            ) : null}
            {options.mode === "edit" && !serverRendered ? (
              <tr>
                <td colSpan="2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      name="block"
                      type="checkbox"
                      checked={disable_inactive}
                      onChange={setAProp("disable_inactive", { checked: true })}
                    />
                    <label className="form-check-label">
                      Disable inactive inputs
                    </label>
                  </div>
                </td>
              </tr>
            ) : null}
            <tr>
              <td colSpan={2}>
                <ArrayManager
                  node={node}
                  setProp={setProp}
                  countProp={"ntabs"}
                  currentProp={"setting_tab_n"}
                  managedArrays={["titles", "acc_init_opens"]}
                  manageContents={true}
                  initialAddProps={{ titles: "New Tab" }}
                ></ArrayManager>
              </td>
            </tr>
            <tr>
              <th colSpan="2">Title</th>
            </tr>
            <tr>
              <td colSpan={2}>
                <input
                  type="text"
                  className="form-control text-to-display"
                  value={titles[use_setting_tab_n] || ""}
                  spellCheck={false}
                  onChange={(e) => {
                    if (!e.target) return;
                    const value = e.target.value;
                    setProp((prop) => (prop.titles[use_setting_tab_n] = value));
                  }}
                />
              </td>
            </tr>
            {options.mode === "show" ||
            options.mode === "edit" ||
            options.mode === "filter" ? (
              <Fragment>
                <tr>
                  <th colSpan="2">Show if formula</th>
                </tr>
                <tr>
                  <td colSpan={2}>
                    <input
                      type="text"
                      spellCheck={false}
                      className="form-control text-to-display"
                      value={showif?.[use_setting_tab_n] || ""}
                      onChange={(e) => {
                        if (!e.target) return;
                        const value = e.target.value;
                        setProp((prop) => {
                          if (!prop.showif) prop.showif = [];
                          prop.showif[use_setting_tab_n] = value;
                        });
                      }}
                    />
                  </td>
                </tr>
              </Fragment>
            ) : null}
            {tabsStyle === "Accordion" ? (
              <tr>
                <td colSpan="2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      name="block"
                      type="checkbox"
                      checked={acc_init_opens?.[use_setting_tab_n] || false}
                      onChange={(e) => {
                        if (!e.target) return;
                        const value = e.target.checked;
                        setProp((prop) => {
                          if (!prop.acc_init_opens) prop.acc_init_opens = [];
                          prop.acc_init_opens[use_setting_tab_n] = value;
                        });
                      }}
                    />
                    <label className="form-check-label">Initially open</label>
                  </div>
                </td>
              </tr>
            ) : null}
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
    showif: [],
    acc_init_opens: [],
    ntabs: 2,
    tabsStyle: "Tabs",
    independent: false,
    startClosed: false,
    deeplink: true,
    disable_inactive: false,
    serverRendered: false,
    setting_tab_n: 0,
    tabId: "",
  },
  defaultProps: { setting_tab_n: 0, ntabs: 2 },
  displayName: "Tabs",
  related: {
    settings: TabsSettings,
  },
};
