/**
 * @category saltcorn-data
 * @module base-plugin/fileview
 * @subcategory base-plugin
 */
const { a, img, script, domReady } = require("@saltcorn/markup/tags");
const { link } = require("@saltcorn/markup");
const { isNode } = require("../utils");
const { div } = require("@saltcorn/markup");

module.exports = {
  /**
   * @namespace
   * @category saltcorn-data
   */
  "Download link": {
    /**
     * @param {string} file_id
     * @param {string} file_name
     * @returns {link}
     */
    run: (file_id, file_name) =>
      link(
        isNode()
          ? `/files/download/${file_id}`
          : `javascript:notifyAlert('File donwloads are not supported.')`,
        file_name || "Download"
      ),
  },
  /**
   * @namespace
   * @category saltcorn-data
   */
  Link: {
    /**
     * @param {string} file_id
     * @param {string} file_name
     * @returns {link}
     */
    run: (file_id, file_name) =>
      link(
        isNode()
          ? `/files/serve/${file_id}`
          : `javascript:openFile(${file_id})`,
        file_name || "Open"
      ),
  },

  /**
   * @namespace
   * @category saltcorn-data
   */
  "Link (new tab)": {
    /**
     * @param {string} file_id
     * @param {string} file_name
     * @returns {a}
     */
    run: (file_id, file_name) =>
      a(
        isNode()
          ? { href: `/files/serve/${file_id}`, target: "_blank" }
          : { href: `javascript:openFile(${file_id})` },
        file_name || "Open"
      ),
  },
  /**
   * @namespace
   * @category saltcorn-data
   */
  "Show Image": {
    /**
     * @param {string} file_id
     * @param {string} file_name
     * @returns {img}
     */
    run: (file_id, file_name) => {
      if (isNode())
        return img({ src: `/files/download/${file_id}`, style: "width: 100%" });
      else {
        const elementId = `_sc_file_id_${file_id}_`;
        return div(
          img({ style: "width: 100%", id: elementId }),
          script(domReady(`buildEncodedImage(${file_id}, '${elementId}')`))
        );
      }
    },
  },
};
