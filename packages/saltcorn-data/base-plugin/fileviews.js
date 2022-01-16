/**
 * @category saltcorn-data
 * @module base-plugin/fileview
 * @subcategory base-plugin
 */
const { text, a, img } = require("@saltcorn/markup/tags");
const { link } = require("@saltcorn/markup");

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
      link(`/files/download/${file_id}`, file_name || "Download"),
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
      link(`/files/serve/${file_id}`, file_name || "Open"),
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
        { href: `/files/serve/${file_id}`, target: "_blank" },
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
    run: (file_id, file_name) =>
      img({ src: `/files/download/${file_id}`, style: "width: 100%" }),
  },
};
