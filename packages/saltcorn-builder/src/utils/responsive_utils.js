/**
 * Get the active alignment value for the current preview device.
 * Used in the builder to show the correct alignment per device.
 *
 * @param {string[]} aligns - Desktop alignment array (per column)
 * @param {string[]} mobileAligns - Mobile alignment array (per column)
 * @param {string[]} tabletAligns - Tablet alignment array (per column)
 * @param {number} ix - Column index
 * @param {string} previewDevice - Current preview device ("desktop"|"tablet"|"mobile")
 * @returns {string} CSS class like "text-start" or ""
 */
export const getAlignClass = (aligns, mobileAligns, tabletAligns, ix, previewDevice) => {
  const desktop = aligns?.[ix];
  const tablet = tabletAligns?.[ix];
  const mobile = mobileAligns?.[ix];

  if (previewDevice === "mobile" && mobile) return `text-${mobile}`;
  if (previewDevice === "tablet" && tablet) return `text-${tablet}`;
  if (desktop) return `text-${desktop}`;
  return "";
};

/**
 * Generate Bootstrap responsive text alignment classes for runtime rendering.
 * Uses mobile-first approach: base class for smallest, then breakpoint overrides.
 *
 * @param {string[]} aligns - Desktop alignment array (per column)
 * @param {string[]} mobileAligns - Mobile alignment array (per column)
 * @param {string[]} tabletAligns - Tablet alignment array (per column)
 * @param {number} ix - Column index
 * @returns {string} Space-separated CSS classes like "text-start text-md-center text-lg-end"
 */
export const getAlignClassRuntime = (aligns, mobileAligns, tabletAligns, ix) => {
  const desktop = aligns?.[ix];
  const tablet = tabletAligns?.[ix];
  const mobile = mobileAligns?.[ix];

  if (!mobile && !tablet) {
    return desktop ? `text-${desktop}` : "";
  }

  const classes = [];

  const base = mobile || desktop;
  if (base) classes.push(`text-${base}`);
  if (tablet && tablet !== base) classes.push(`text-md-${tablet}`);
  if (desktop && desktop !== (tablet || base))
    classes.push(`text-lg-${desktop}`);
  return classes.join(" ");
};

/**
 * Get the active value for a per-device setting based on the preview device.
 * Generic helper for any setting that supports per-device overrides.
 *
 * @param {*} desktopValue - Desktop value
 * @param {*} tabletValue - Tablet override (optional)
 * @param {*} mobileValue - Mobile override (optional)
 * @param {string} previewDevice - Current preview device
 * @returns {*} The active value for the current device
 */
export const getDeviceValue = (desktopValue, tabletValue, mobileValue, previewDevice) => {
  if (previewDevice === "mobile" && mobileValue != null) return mobileValue;
  if (previewDevice === "tablet" && tabletValue != null) return tabletValue;
  return desktopValue;
};

/**
 * Get the device-specific property name for a given base property.
 * E.g. getDevicePropName("width", "mobile") => "mobileWidth"
 *
 * @param {string} propName - Base property name (e.g. "width", "height")
 * @param {string} previewDevice - Current preview device ("mobile"|"tablet")
 * @returns {string} Device-specific property name
 */
export const getDevicePropName = (propName, previewDevice) => {
  const cap = propName.charAt(0).toUpperCase() + propName.slice(1);
  return previewDevice === "mobile" ? `mobile${cap}` : `tablet${cap}`;
};

/**
 * Create a proxied node object that reads width/height from device-specific props
 * as if they were in the style object. Used by BoxModelEditor for per-device size editing.
 *
 * @param {object} node - The Craft.js node props
 * @param {string} propName - "width" or "height"
 * @param {string} previewDevice - Current preview device
 * @returns {object} Proxied node with device value in style[propName]
 */
export const getDeviceSizeNode = (node, propName, previewDevice) => {
  const deviceProp = getDevicePropName(propName, previewDevice);
  return {
    ...node,
    style: { ...(node.style || {}), [propName]: node[deviceProp] || "" },
  };
};

/**
 * Create a proxied setProp function that writes to device-specific props
 * instead of the style object. Used by BoxModelEditor for per-device size editing.
 *
 * @param {function} setProp - The Craft.js setProp function
 * @param {string} propName - "width" or "height"
 * @param {string} previewDevice - Current preview device
 * @returns {function} Proxied setProp that intercepts style writes
 */
export const getDeviceSizeSetProp = (setProp, propName, previewDevice) => {
  const deviceProp = getDevicePropName(propName, previewDevice);
  return (fn) => {
    const proxy = { style: {} };
    fn(proxy);
    const val = proxy.style[propName];
    if (val !== undefined) {
      setProp((prop) => { prop[deviceProp] = val; });
    }
  };
};

/**
 * Get the display value for width/height in the box model visual,
 * taking into account the current preview device and sizeWithStyle mode.
 *
 * @param {object} node - The Craft.js node props
 * @param {string} propName - "width" or "height"
 * @param {string} previewDevice - Current preview device
 * @param {boolean} sizeWithStyle - Whether size is stored in style object
 * @returns {string} Display value like "200px" or ""
 */
export const getDisplaySize = (node, propName, previewDevice, sizeWithStyle) => {
  const isDesktop = !previewDevice || previewDevice === "desktop";
  if (!isDesktop) {
    const deviceProp = getDevicePropName(propName, previewDevice);
    if (node[deviceProp]) return node[deviceProp];
  }
  if (sizeWithStyle) return (node.style || {})[propName];
  const val = node[propName];
  const unit = node[propName + "Unit"];
  return val ? `${val}${unit || "px"}` : "";
};
