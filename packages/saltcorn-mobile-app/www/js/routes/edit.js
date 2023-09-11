/*global i18next, apiCall, saltcorn, offlineHelper*/

// /toggle/:name/:id/:field_name
const postToggleField = async (context) => {
  const { name, id, field_name } = context.params;
  const table = await saltcorn.data.models.Table.findOne({ name });
  const state = saltcorn.data.state.getState();
  const { isOfflineMode, localTableIds, user_name, role_id } =
    state.mobileConfig;
  if (isOfflineMode || localTableIds.indexOf(table.id) >= 0) {
    if (role_id > table.min_role_write)
      throw new saltcorn.data.utils.NotAuthorized(i18next.t("Not authorized"));
    await table.toggleBool(+id, field_name); //TODO call with user
    if (isOfflineMode && !(await offlineHelper.getLastOfflineSession()))
      await offlineHelper.setOfflineSession({ offlineUser: user_name });
  } else {
    await apiCall({
      method: "POST",
      path: `/edit/toggle/${name}/${id}/${field_name}`,
    });
  }
  const redirect = new URLSearchParams(context.query).get("redirect");
  return { redirect };
};
