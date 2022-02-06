// For the typedoc documentation

/**
 * This is the saltcorn-admin-models package.
 * It contains models only required by the admin interface.
 * @module
 */
import backupImport from "./models/backup";
/**
 * This is the backup module
 */
export namespace backup {
  export const { create_backup, restore, create_csv_from_rows } = backupImport;
}

import packImport from "./models/pack";
/**
 * This is the pack module
 */
export namespace pack {
  export const {
    table_pack,
    view_pack,
    plugin_pack,
    page_pack,
    role_pack,
    library_pack,
    trigger_pack,
    install_pack,
    fetch_available_packs,
    fetch_pack_by_name,
    can_install_pack,
    uninstall_pack,
    add_to_menu,
  } = packImport;
}

import tenantImport from "./models/tenant";
/**
 * This is the tenant module
 */
export namespace tenant {
  export const {
    create_tenant,
    insertTenant,
    switchToTenant,
    getAllTenants,
    getAllTenantRows,
    domain_sanitize,
    deleteTenant,
    eachTenant,
    copy_tenant_template,
  } = tenantImport;
}
