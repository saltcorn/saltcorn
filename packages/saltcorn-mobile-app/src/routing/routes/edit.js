/*global saltcorn */
import { apiCall } from "../../helpers/api";
import { setHasOfflineData } from "../../helpers/offline_mode";
import i18next from "i18next";

// /toggle/:name/:id/:field_name
export const postToggleField = async (context) => {
  const { name, id, field_name } = context.params;
  const table = await saltcorn.data.models.Table.findOne({ name });
  const state = saltcorn.data.state.getState();
  const { isOfflineMode, localTableIds, user } = state.mobileConfig;
  if (isOfflineMode || localTableIds.indexOf(table.id) >= 0) {
    if (user.role_id > table.min_role_write)
      throw new saltcorn.data.utils.NotAuthorized(i18next.t("Not authorized"));
    await table.toggleBool(+id, field_name); //TODO call with user
    if (isOfflineMode) await setHasOfflineData(true);
  } else {
    await apiCall({
      method: "POST",
      path: `/edit/toggle/${name}/${id}/${field_name}`,
    });
  }
  const redirect = new URLSearchParams(context.query).get("redirect");
  return { redirect };
};
