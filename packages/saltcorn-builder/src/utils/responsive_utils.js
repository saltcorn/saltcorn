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
