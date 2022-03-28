// post/delete/:name/:id
export const deleteRows = async (context) => {
  const { name, id } = context.params;
  let redirect = new URLSearchParams(context.query).get("redirect");
  const table = await saltcorn.data.models.Table.findOne({ name });
  try {
    // TODO ch call service
    await table.deleteRows({ id });
  } catch (error) {
    console.log("error while deleting");
    console.log(error);
  }
  return { redirect };
};
