declare const window: any;

export const getConnectObject = () => {
  return {
    sqlite_path: "default",
    sqlite_db_name: "scdb.sqlite",
    default_schema: "public",
    fixed_configuration: {},
    inherit_configuration: [],
    version_tag: window.config.version_tag,
  };
};
