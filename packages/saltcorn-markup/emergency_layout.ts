/**
 * @category saltcorn-markup
 * @module emergency_layout
 */

import tags = require("./tags");
const { ul, li, a, span, hr, div, text, i, h6, h1, p, header, img, footer } =
  tags;
import renderLayout = require("./layout");
const { renderForm, link } = require(".");
import layoutUtils = require("./layout_utils");
const { navbar, alert } = layoutUtils;

/**
 * @param {string} title
 * @param {string|object} body
 * @param {object[]} alerts
 * @returns {string}
 */
const renderBody = (
  title: string,
  body: string | any,
  alerts: any[],
  req: any
): string =>
  renderLayout({
    blockDispatch: {},
    req,
    layout:
      typeof body === "string" ? { type: "card", title, contents: body } : body,
    alerts,
  });

// declaration merging
namespace EmergencyLayoutExports {
  export type WrapParams = {
    title: string;
    menu: any;
    brand: any;
    req: any;
    alerts: any[];
    currentUrl: string;
    body: string | any;
    headers: any[];
  };
}
type WrapParams = EmergencyLayoutExports.WrapParams;

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {object} opts.menu
 * @param {object} opts.brand
 * @param {object[]} opts.alerts
 * @param {string} opts.currentUrl
 * @param {string|object} opts.body
 * @param {object[]} opts.headers
 * @param {object} opts.req
 * @returns {string}
 */
const wrap = ({
  title,
  menu,
  brand,
  alerts,
  currentUrl,
  body,
  headers,
  req,
}: WrapParams): string =>
  navbar(brand, menu, currentUrl) + renderBody(title, body, alerts, req);

const EmergencyLayoutExports = wrap;
export = EmergencyLayoutExports;
