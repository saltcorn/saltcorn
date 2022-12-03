/*global layout, getHeaders, saltcorn*/

const getErrorView = async (context) => {
  const state = saltcorn.data.state.getState();
  const wrappedContent = layout().wrap({
    title: "Error",
    body: { above: [""] },
    alerts: context.alerts ,
    role: state.mobileConfig.role_id,
    headers: getHeaders(),
    menu: [],
    bodyClass: "",
    currentUrl: "",
    brand: {},
  });

  return { content: wrappedContent, title: "Error" };
};
