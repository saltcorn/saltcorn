/*global wrapContents, MobileRequest */

const getErrorView = async (context) => {
  return wrapContents("", "Error", context, new MobileRequest());
};
