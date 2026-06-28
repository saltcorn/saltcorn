// Mobile mock for "apns2". Stubs satisfy the ESM named imports in the bundled
// @saltcorn/data; Apple push delivery is handled natively on mobile. The export
// surface mirrors the real package (Host/Priority/PushType/Errors are value
// enums that calling code may dereference, so we keep their real shapes).
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

export const Host = {
  production: "api.push.apple.com",
  development: "api.sandbox.push.apple.com",
};

export const Priority = {
  immediate: 10,
  throttled: 5,
  low: 1,
};

export const PushType = {
  alert: "alert",
  background: "background",
  voip: "voip",
  complication: "complication",
  fileprovider: "fileprovider",
  mdm: "mdm",
  liveactivity: "liveactivity",
  location: "location",
  pushtotalk: "pushtotalk",
};

export const Errors: Record<string, string> = {};
