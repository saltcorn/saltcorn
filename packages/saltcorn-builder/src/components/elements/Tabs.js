import React, { Fragment, useState } from "react";
import { ntimes } from "./Columns";
import { Column } from "./Column";

import { Element, useNode } from "@craftjs/core";

export const Tabs = ({ contents, titles, tabStyle, ntabs }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const [showTab, setShowTab] = useState(0);

  return (
    <Fragment>
      <ul
        id="myTab"
        role="tablist"
        className={`nav nav-tabs builder ${selected ? "selected-node" : ""}`}
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
        <div
          className={`tab-pane fade show active`}
          role="tabpanel"
          aria-labelledby="home-tab"
        >
          <Element canvas id={`Tab${showTab}`} is={Column}>
            {contents[showTab]}
          </Element>
        </div>
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
              className="w-100 ml-2"
              onChange={(e) =>
                setProp((prop) => {
                  prop.tabsStyle = e.target.value;
                })
              }
            >
              <option>Tabs</option>
              {/* <option>Pills</option>
              <option>Accordion</option>*/}
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
          <th colspan="2">Titles</th>
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
    titles: [],
    ntabs: 2,
    tabStyle: "Tabs",
  },
  displayName: "Tabs",
  related: {
    settings: TabsSettings,
  },
};
