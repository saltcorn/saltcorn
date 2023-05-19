/*global i18next, apiCall, saltcorn, offlineHelper*/

// post/delete/:name/:id
const deleteRows = async (context) => {
  const { name, id } = context.params;
  const table = await saltcorn.data.models.Table.findOne({ name });
  const { isOfflineMode, localTableIds, role_id } =
    saltcorn.data.state.getState().mobileConfig;
  if (isOfflineMode || localTableIds.indexOf(table.id) >= 0) {
    if (role_id <= table.min_role_write) {
      await table.deleteRows({ id });
    }
    if (isOfflineMode && !(await offlineHelper.hasOfflineRows())) {
      await offlineHelper.setOfflineSession(null);
    }
    // TODO 'table.is_owner' check?
    else {
      throw new Error(i18next.t("Not authorized"));
    }
  } else {
    await apiCall({ method: "POST", path: `/delete/${name}/${id}` });
  }
  const redirect = context.data?.after_delete_url
    ? context.data.after_delete_url === "/"
      ? "/"
      : `get${new URL(context.data?.after_delete_url).pathname}`
    : new URLSearchParams(context.query).get("redirect");
  return { redirect };
};
