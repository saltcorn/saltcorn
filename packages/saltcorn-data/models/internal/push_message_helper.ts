import File from "../file";
import type Notification from "../notification";
import db from "../../db";
import utils from "../../utils";
const { getSafeBaseUrl, decodeProvisioningProfile } = utils;
import webpush from "web-push";
import admin from "firebase-admin";
import {
  ApnsClient,
  SilentNotification,
  Notification as Apns2Notification,
} from "apns2";
import { readFile } from "fs/promises";

type PushMessageHelperConfig = {
  icon?: string;
  badge?: string;
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  vapidEmail?: string;
  pushNotificationIcon?: string;
  pushNotificationBadge?: string;

  firebase?: {
    jsonPath: string;
    jsonContent: any;
  };

  apns?: {
    signingKeyId: string;
    signingKey: string;
    teamId: string;
    appId: string;
    provisioningProfile: string;
  };

  notificationSubs?: Record<
    string,
    Array<WebPushSubscription | MobileSubscription>
  >;
  syncSubs?: Record<string, Array<MobileSubscription>>;
};

const prepareConfig = async (oldInstance?: any) => {
  const state = require("../../db/state").getState();
  const config: PushMessageHelperConfig = {
    icon: state.getConfig("push_notification_icon"),
    badge: state.getConfig("push_notification_badge"),
    vapidPublicKey: state.getConfig("vapid_public_key"),
    vapidPrivateKey: state.getConfig("vapid_private_key"),
    vapidEmail: state.getConfig("vapid_email"),
    notificationSubs: state.getConfig("push_notification_subscriptions", {}),
    syncSubs: state.getConfig("push_sync_subscriptions", {}),
  };

  const builderSettings = state.getConfig("mobile_builder_settings", {});
  const {
    apnSigningKey,
    apnSigningKeyId,
    provisioningProfile,
    appId,
    firebaseJSONKey,
  } = builderSettings;

  if (apnSigningKey && apnSigningKeyId && provisioningProfile && appId) {
    let keyContent = null;
    if (oldInstance && oldInstance.apnsSigningKey === apnSigningKey) {
      keyContent = oldInstance.apns?.signingKey;
    } else {
      const signingKeyFile = await File.findOne(apnSigningKey);
      if (signingKeyFile) {
        keyContent = await readFile(signingKeyFile.absolutePath);
      }
    }

    let teamId = null;
    if (
      oldInstance &&
      oldInstance.apns?.provisioningProfile === provisioningProfile
    ) {
      teamId = oldInstance.apns.teamId;
    } else {
      const decoded = await decodeProvisioningProfile(provisioningProfile);
      teamId = decoded.teamId;
    }

    config.apns = {
      teamId: teamId,
      appId: appId,
      signingKey: keyContent,
      provisioningProfile: provisioningProfile,
      signingKeyId: apnSigningKeyId,
    };
  }

  if (firebaseJSONKey) {
    let jsonContent = null;
    if (oldInstance && oldInstance.firebaseJsonPath === firebaseJSONKey) {
      jsonContent = oldInstance.firebaseJsonContent;
    } else {
      const firebaseFile = await File.findOne(firebaseJSONKey);
      if (firebaseFile && !firebaseFile.isDirectory) {
        jsonContent = require(firebaseFile.absolutePath);
      }
    }
    config.firebase = {
      jsonPath: firebaseJSONKey,
      jsonContent: jsonContent,
    };
  }

  return config;
};

export type WebPushSubscription = {
  type: "web-push";
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type MobileSubscription = {
  type: "fcm-push" | "apns-push";
  token: string;
  deviceId: string;
};

/**
 * PushMessageHelper Class
 * @category saltcorn-data
 * @module models/internal/push_message_helper
 * @subcategory models
 */
export class PushMessageHelper {
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  vapidEmail?: string;
  icon?: string;
  badge?: string;

  firebase?: {
    jsonPath: string;
    jsonContent: any;
  };
  firebaseApp?: admin.app.App | null;

  apns?: {
    teamId: string;
    signingKey: string;
    signingKeyId: string;
    appId: string;
  };
  apnsClient?: ApnsClient;

  state: any;
  notificationSubs: Record<
    string,
    Array<WebPushSubscription | MobileSubscription>
  >;
  syncSubs: Record<string, Array<MobileSubscription>>;

  private syncQueued = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private lastSyncSentAt = 0;
  private readonly syncDebounceMs = 5000;
  private readonly minSyncIntervalMs = 30000;

  /**
   * normal first init
   * @param config - PushMessageHelper configuration
   */
  constructor(config: PushMessageHelperConfig) {
    this.vapidPublicKey = config.vapidPublicKey;
    this.vapidPrivateKey = config.vapidPrivateKey;
    this.vapidEmail = config.vapidEmail;
    this.icon = config.pushNotificationIcon;
    this.badge = config.pushNotificationBadge;
    this.notificationSubs = config.notificationSubs || {};
    this.syncSubs = config.syncSubs || {};

    this.apns = config.apns;
    this.firebase = config.firebase;

    this.state = require("../../db/state").getState();
    if (this.firebase) this.initFCMApp();
    if (this.apns) this.initApnsClient();
  }

  /**
   * factory
   * @param config
   */
  public static async createInstance(): Promise<PushMessageHelper> {
    const config = await prepareConfig();
    return new PushMessageHelper(config);
  }

  /**
   * will be used when a config changes (no complete re-init)
   */
  public async refreshInstance() {
    const config = await prepareConfig(this);

    this.vapidPublicKey = config.vapidPublicKey;
    this.vapidPrivateKey = config.vapidPrivateKey;
    this.vapidEmail = config.vapidEmail;
    this.icon = config.pushNotificationIcon;
    this.badge = config.pushNotificationBadge;
    this.notificationSubs = config.notificationSubs || {};
    this.syncSubs = config.syncSubs || {};

    if (config.firebase?.jsonPath !== this.firebase?.jsonPath) {
      this.firebase = config.firebase;
      if (this.firebase?.jsonContent) this.initFCMApp();
    }

    if (JSON.stringify(config.apns || {}) !== JSON.stringify(this.apns || {})) {
      this.apns = config.apns;
      if (this.apns) this.initApnsClient();
    }
  }

  /**
   * Sends a notification to all subscriptions.
   * @param {Notification} notification - The notification to send.
   */
  public async pushNotification(notification: Notification) {
    const usedDeviceIds = new Set<string>();
    for (const subscription of this.notificationSubs[notification.user_id] ||
      []) {
      try {
        switch (subscription.type) {
          case "fcm-push":
          case "apns-push": {
            if (usedDeviceIds.has(subscription.deviceId)) {
              this.state.log(
                5,
                `Skipping FCM notification to device ${subscription.deviceId} as already used`
              );
              continue;
            }
            if (subscription.type === "fcm-push")
              await this.fcmPush(notification, subscription);
            else await this.apnsPush(notification, subscription);
            usedDeviceIds.add(subscription.deviceId);

            break;
          }
          case "web-push":
          default: {
            await this.webPush(notification, subscription);
            break;
          }
        }
      } catch (error) {
        this.state.log(5, `Error sending push notification: ${error}`);
      }
    }
  }

  /**
   * queue a sync or do nothing if already queued
   * @returns true if queued
   */
  public queuePushSync() {
    if (!this.syncQueued) {
      this.syncQueued = true;
      this.syncTimer = setTimeout(async () => {
        this.syncTimer = null;
        const now = Date.now();
        const timeSinceLast = now - this.lastSyncSentAt;
        if (timeSinceLast < this.minSyncIntervalMs) {
          const delay = this.minSyncIntervalMs - timeSinceLast;
          this.state.log(
            5,
            `Delaying sync push by ${delay}ms to respect min interval`
          );
          setTimeout(() => this.flushSyncQueue(), delay);
        } else {
          await this.flushSyncQueue();
        }
      }, this.syncDebounceMs);
      return true;
    }
    return false;
  }

  /**
   * Sends a sync push to all sync subscriptions.
   * APNS or FCM
   */
  public async pushSync() {
    for (const userSubs of Object.values(this.syncSubs)) {
      const pushedDeviceIds = new Set<string>();
      for (const userSub of userSubs) {
        if (pushedDeviceIds.has(userSub.deviceId)) {
          console.log(
            `Skipping push sync to device ${userSub.deviceId} as already pushed`
          );
          continue;
        }
        try {
          const { token, type, deviceId } = userSub;
          switch (type) {
            case "apns-push":
              const sn = new SilentNotification(token);
              try {
                if (!this.apnsClient)
                  throw new Error("APNS client not initialized");
                const response = await this.apnsClient.send(sn);
                this.state.log(
                  5,
                  `silent APNS notification sent successfully to '${deviceId}', ` +
                    `type: '${response.pushType}', priority: '${
                      response.priority
                    }', 'options: ${JSON.stringify(response.options)}`
                );
              } catch (err: any) {
                console.error(err);
              }
              break;
            case "fcm-push":
              if (!this.firebaseApp)
                throw new Error("Firebase app not initialized");
              const messageId = await admin.messaging(this.firebaseApp).send({
                token: token,
                data: { type: "push_sync" },
              });
              this.state.log(
                5,
                `Sync push sent successfully. FCM messageId: ${messageId}`
              );
              break;
            default:
              throw new Error(`Unknown push subscription type: ${type}`);
          }
          pushedDeviceIds.add(deviceId);
        } catch (error) {
          this.state.log(5, `Error sending sync push: ${error}`);
        }
      }
    }
  }

  private async flushSyncQueue() {
    try {
      this.syncQueued = false;
      this.lastSyncSentAt = Date.now();
      this.state.log(5, "Flushing sync push");
      await this.pushSync();
    } catch (error) {
      this.state.log(5, `Error flushing sync queue: ${error}`);
    }
  }

  private async webPush(notification: Notification, sub: WebPushSubscription) {
    this.state.log(5, `Sending web push notification to ${sub.endpoint}`);
    if (!(this.vapidPublicKey && this.vapidPrivateKey && this.vapidEmail))
      throw new Error("VAPID not configured");
    const payload: any = {
      title: notification.title,
      body: notification.body,
    };
    if (this.icon) payload.icon = `/files/serve/${this.icon}`;
    if (this.badge) payload.badge = `/files/serve/${this.badge}`;
    await webpush.sendNotification(sub, JSON.stringify(payload), {
      vapidDetails: {
        subject: `mailto:${this.vapidEmail}`,
        publicKey: this.vapidPublicKey,
        privateKey: this.vapidPrivateKey,
      },
    });
  }

  private async fcmPush(notification: Notification, sub: MobileSubscription) {
    this.state.log(5, "Sending FCM notification");
    if (!this.firebase) throw new Error("Firebase not configured");
    else if (!this.firebaseApp) throw new Error("Firebase not initialized");
    else {
      const notificationData: any = {
        title: notification.title,
        body: notification.body,
      };
      if (this.icon) {
        const baseUrl = getSafeBaseUrl();
        if (baseUrl)
          notificationData.imageUrl = `${baseUrl}/files/serve/${this.icon}`;
      }
      const data = {
        type: "push_notification",
      };
      const messageId = await admin.messaging(this.firebaseApp).send({
        token: sub.token,
        notification: notificationData,
        data: data,
      });
      this.state.log(5, `FCM notification sent successfully: ${messageId}`);
    }
  }

  private async apnsPush(notification: Notification, sub: MobileSubscription) {
    this.state.log(5, "Sending APNS notification");
    if (!this.apnsClient) throw new Error("APNS client not initialized");
    const apnsNotification = new Apns2Notification(sub.token, {
      alert: {
        title: notification.title,
        body: notification.body || "",
      },
      badge: 1,
      data: {
        type: "push_notification",
      },
      // TODO icon is app icon
    });
    try {
      const response = await this.apnsClient.send(apnsNotification);
      this.state.log(
        5,
        `APNS notification sent successfully to '${sub.deviceId}', ` +
          `type: '${response.pushType}', priority: '${
            response.priority
          }', 'options: ${JSON.stringify(response.options)}`
      );
    } catch (err: any) {
      this.state.log(
        5,
        `Error sending APNS notification: ${err.reason || "unknown error"}`
      );
    }
  }

  private async initFCMApp() {
    this.state.log(5, "Init FCM App");
    if (!this.firebase) throw new Error("Firebase not configured");
    const appName = `${db.getTenantSchema()}_fcm_app`;
    try {
      const existingApp = admin.app(appName);
      await existingApp.delete();
      this.state.log(5, `Deleted existing Firebase app: ${appName}`);
    } catch (err) {
      // app does not exist – safe to ignore
    }
    const app = admin.initializeApp(
      {
        credential: admin.credential.cert(this.firebase.jsonContent),
      },
      appName
    );
    this.firebaseApp = app;
    this.state.log(5, `Initialized Firebase app: ${appName}`);
  }

  private async initApnsClient() {
    this.state.log(5, "Init APNS Client");
    if (!this.apns) throw new Error("APNS not configured");
    this.apnsClient = new ApnsClient({
      team: this.apns.teamId,
      keyId: this.apns.signingKeyId,
      signingKey: this.apns.signingKey,
      defaultTopic: this.apns.appId,
      requestTimeout: 0, // optional, Default: 0 (without timeout)
      keepAlive: true, // optional, Default: 5000
    });
  }
}
