// post/delete/:name/:id
export const deleteRows = async (context) => {
  const { name, id } = context.params;
  try {
    const table = await saltcorn.data.models.Table.findOne({ name });
    const state = saltcorn.data.state.getState();
    if (state.mobileConfig.localTableIds.indexOf(table.id) >= 0) {
      await table.deleteRows({ id });
    } else {
      await apiCall({ method: "POST", path: `/delete/${name}/${id}` });
    }
    const redirect = context.data?.after_delete_url
      ? context.data.after_delete_url === "/"
        ? "/"
        : `get${new URL(context.data?.after_delete_url).pathname}`
      : new URLSearchParams(context.query).get("redirect");
    return { redirect };
  } catch (error) {
    // TODO ch message?
    return null;
  }
};
