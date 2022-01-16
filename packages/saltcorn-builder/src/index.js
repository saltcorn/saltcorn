/**
 * @category saltcorn-builder
 * @module saltcorn-builder/index
 */

/**
 * All files in the saltcorn-builder package.
 * @namespace saltcorn-builder_overview
 * @property {module:components/Builder} Builder
 * @property {module:components/context} context
 * @property {module:components/Library} Library
 * @property {module:components/preview_context} preview_context
 * @property {module:components/RenderNode} RenderNode
 * @property {module:components/storage} storage
 * @property {module:components/Toolbox} Toolbox
 * 
 * @category saltcorn-builder
 */ 

/**
 * All files in the elements folder.
 * @namespace saltcorn-builder_overview/elements
 * @memberof module:saltcorn-builder/index~saltcorn-builder_overview
 * @property {module:components/elements/Action} Action
 * @property {module:components/elements/Aggregation} Aggregation
 * @property {module:components/elements/BoxModelEditor} BoxModelEditor
 * @property {module:components/elements/Card} Card
 * @property {module:components/elements/Column} Column
 * @property {module:components/elements/Columns} Columns
 * @property {module:components/elements/Container} Container
 * @property {module:components/elements/DropDownFilter} DropDownFilter
 * @property {module:components/elements/Empty} Empty
 * @property {module:components/elements/faicons} faicons
 * @property {module:components/elements/Field} Field
 * @property {module:components/elements/HTMLCode} HTMLCode
 * @property {module:components/elements/Image} Image
 * @property {module:components/elements/JoinField} JoinField
 * @property {module:components/elements/LineBreak} LineBreak
 * @property {module:components/elements/Link} Link
 * @property {module:components/elements/SearchBar} SearchBar
 * @property {module:components/elements/Tabs} Tabs
 * @property {module:components/elements/Text} Text
 * @property {module:components/elements/ToggleFilter} ToggleFilter
 * @property {module:components/elements/utils} utils
 * @property {module:components/elements/View} View
 * @property {module:components/elements/ViewLink} ViewLink
 * 
 * @category saltcorn-builder
 */

import React from "react";
import Builder from "./components/Builder";
import ReactDOM from "react-dom";

/**
 * 
 * @param {object} id 
 * @param {object} options 
 * @param {object} layout 
 * @param {string} mode 
 */
function renderBuilder(id, options, layout, mode) {
  ReactDOM.render(
    <Builder
      options={JSON.parse(decodeURIComponent(options))}
      layout={JSON.parse(decodeURIComponent(layout))}
      mode={mode}
    />,
    document.getElementById(id)
  );
}

export { renderBuilder };
