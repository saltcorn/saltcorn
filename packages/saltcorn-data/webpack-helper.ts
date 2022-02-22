declare const window: any;

export const isNode = () => {
  return typeof window === "undefined";
};
