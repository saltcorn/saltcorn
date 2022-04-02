// post/delete/:name/:id
export const deleteRows = async (context) => {
  const { name, id } = context.params;
  try {
    await apiCall({ method: "POST", path: `/delete/${name}/${id}` });
    const redirect = new URLSearchParams(context.query).get("redirect");
    return { redirect };
  } catch (error) {
    // TODO ch message?
    return null;
  }
};
