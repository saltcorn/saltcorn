/*global i18next, apiCall, saltcorn*/

// /toggle/:name/:id/:field_name
const postToggleField = async (context) => {
  const { name, id, field_name } = context.params;
  const table = await saltcorn.data.models.Table.findOne({ name });
  const state = saltcorn.data.state.getState();
  const { isOfflineMode, localTableIds, user_name, role_id } =
    state.mobileConfig;
  if (isOfflineMode || localTableIds.indexOf(table.id) >= 0) {
    if (role_id > table.min_role_write)
      throw new Error(i18next.t("Not authorized"));
    await table.toggleBool(+id, field_name);
    if (isOfflineMode)
      await state.setConfig("user_with_offline_data", user_name);
  } else {
    await apiCall({
      method: "POST",
      path: `/edit/toggle/${name}/${id}/${field_name}`,
    });
  }
  const redirect = new URLSearchParams(context.query).get("redirect");
  return { redirect };
};
