const execSync = (command: string, options?: any) => {
  throw new Error("exec sync may not be called in a mobile enviroment");
};

export = execSync;
