import { MobileRequest } from "../mocks/request";
import { wrapContents } from "../utils";

export const getErrorView = async (context) => {
  return wrapContents("", "Error", context, new MobileRequest());
};
