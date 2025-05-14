export class AsyncLocalStorage {
  constructor() {}
 
  getStore() {
    return undefined;
  }

  run(store: any, callback: () => any) {
    return callback();
  }
}
