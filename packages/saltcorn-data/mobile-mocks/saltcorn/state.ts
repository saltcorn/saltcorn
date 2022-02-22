const getState = () => {
  return {
    refresh: async () => {
      console.log("mocked refresh");
    },
  };
};
export = { getState };
