// Mobile mock for "apns2". Stubs satisfy the ESM named imports in the bundled
// @saltcorn/data; Apple push delivery is handled natively on mobile.
export class ApnsClient {
  constructor(_options?: any) {}
  send(_notification?: any): Promise<any> {
    throw new Error("apns2 may not be used in a mobile enviroment");
  }
}
export class Notification {
  constructor(_deviceToken?: any, _options?: any) {}
}
export class SilentNotification {
  constructor(_deviceToken?: any, _options?: any) {}
}
