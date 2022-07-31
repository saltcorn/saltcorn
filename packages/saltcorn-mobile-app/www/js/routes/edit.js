// /toggle/:name/:id/:field_name
export const postToggleField = async (context) => {
  const { name, id, field_name } = context.params;
  const table = await saltcorn.data.models.Table.findOne({ name });
  const mobileConfig = saltcorn.data.state.getState().mobileConfig;
  if (mobileConfig.localTableIds.indexOf(table.id) >= 0) {
    if (mobileConfig.role_id > table.min_role_write)
      throw new Error($.i18n("Not authorized"));
    await table.toggleBool(+id, field_name);
  } else {
    await apiCall({
      method: "POST",
      path: `/edit/toggle/${name}/${id}/${field_name}`,
    });
  }
  const redirect = new URLSearchParams(context.query).get("redirect");
  return { redirect };
};
