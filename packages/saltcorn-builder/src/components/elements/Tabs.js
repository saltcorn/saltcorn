import React, { Fragment, useState } from "react";
import { ntimes } from "./Columns";
import { Column } from "./Column";

import { Element, useNode } from "@craftjs/core";

export const Tabs = ({ contents, titles, tabsStyle, ntabs }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const [showTab, setShowTab] = useState(0);
  if (tabsStyle === "Accordion")
    return (
      <div className="accordion">
        {ntimes(ntabs, (ix) => (
          <div className="card">
            <div className="card-header">
              <h2 className="mb-0">
                <button
                  className="btn btn-link btn-block text-left"
                  type="button"
                  onClick={() => setShowTab(ix)}
                >
                  {titles[ix]}
                </button>
              </h2>
            </div>

            <div
              id="collapseOne"
              className={`collapse ${ix === showTab ? "show" : ""}`}
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
          {ntimes(ntabs, (ix) => (
            <li key={ix} className="nav-item" role="presentation">
              <a
                className={`nav-link ${ix === showTab ? `active` : ""}`}
                onClick={() => setShowTab(ix)}
              >
                {titles[ix]}
              </a>
            </li>
          ))}
        </ul>
        <div className="tab-content" id="myTabContent">
          {ntimes(ntabs, (ix) => (
            <div
              key={ix}
              className={`tab-pane fade ${ix === showTab ? `show active` : ""}`}
              role="tabpanel"
              aria-labelledby="home-tab"
            >
              <Element canvas id={`Tab${ix}`} is={Column}>
                {contents[ix]}
              </Element>
            </div>
          ))}
        </div>
      </Fragment>
    );
};

export const TabsSettings = () => {
  const node = useNode((node) => ({
    tabsStyle: node.data.props.tabsStyle,
    ntabs: node.data.props.ntabs,
    titles: node.data.props.titles,
  }));
  const {
    actions: { setProp },
    titles,
    tabsStyle,
    ntabs,
  } = node;
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
              className="form-control"
              onChange={(e) =>
                setProp((prop) => {
                  prop.tabsStyle = e.target.value;
                })
              }
            >
              <option>Tabs</option>
              <option>Pills</option>
              <option>Accordion</option>
            </select>
          </td>
        </tr>
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
              onChange={(e) => setProp((prop) => (prop.ntabs = e.target.value))}
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
                onChange={(e) =>
                  setProp((prop) => (prop.titles[ix] = e.target.value))
                }
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
Tabs.craft = {
  props: {
    titles: ["Tab1", "Tab2"],
    ntabs: 2,
    tabsStyle: "Tabs",
  },
  displayName: "Tabs",
  related: {
    settings: TabsSettings,
  },
};
