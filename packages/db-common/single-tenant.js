/**
 * @category db-common
 * @module single-tenant
 */

module.exports = /**
 * @function
 * @name "module.exports function"
 * @returns {exports}
 */
(connObj) => ({
  /**
   * @returns {string}
   */
  getTenantSchema: () => connObj.default_schema,
  /** 
   * @returns {false}
   */
  is_it_multi_tenant: () => false,
  enable_multi_tenant() {},
  /**
   * @param {*} t 
   * @param {function} f 
   * @returns {*}
   */
  runWithTenant(t, f) {
    return f();
  },
});

