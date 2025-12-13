import db from "../../db";
import webpush from "web-push";
import admin from "firebase-admin";
import utils from "../../utils";
import type Notification from "../notification";

const { getSafeBaseUrl } = utils;

// Web
export type WebPushSubscription = {
  type: "web-push";
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

// FCM
export type FcmSubscription = {
  type: "fcm-push";
  token: string;
  deviceId: string;
};

export type Subscription = WebPushSubscription | FcmSubscription;

type PushMessageHelperConfig = {
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  vapidEmail?: string;
  pushNotificationIcon?: string;
  pushNotificationBadge?: string;

  firebase: {
    jsonPath?: string;
    jsonContent?: any;
  };

  notificationSubs?: Record<string, Array<Subscription>>;
  syncSubs?: Record<string, Array<FcmSubscription>>;
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

  firebaseJsonPath?: string;
  firebaseJsonContent?: any;
  firebaseApp?: admin.app.App | null;

  notificationSubs: Record<string, Array<Subscription>>;
  syncSubs: Record<string, Array<FcmSubscription>>;

  state: any;

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
    this.firebaseJsonPath = config.firebase.jsonPath;
    this.firebaseJsonContent = config.firebase.jsonContent;
    this.state = require("../../db/state").getState();
    if (this.firebaseJsonContent) this.initFCMApp();
  }

  /**
   * will be used when a config changes (no complete re-init)
   * @param {PushMessageHelperConfig} config - new configuration.
   */
  public updateConfig(config: any) {
    this.vapidPublicKey = config.vapidPublicKey;
    this.vapidPrivateKey = config.vapidPrivateKey;
    this.vapidEmail = config.vapidEmail;
    this.icon = config.pushNotificationIcon;
    this.badge = config.pushNotificationBadge;
    this.notificationSubs = config.notificationSubs || {};
    this.syncSubs = config.syncSubs || {};
    if (config.firebase.jsonPath !== this.firebaseJsonPath) {
      this.firebaseJsonPath = config.firebase.jsonPath;
      this.firebaseJsonContent = config.firebase.jsonContent;
      if (this.firebaseJsonContent) this.initFCMApp();
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
          case "fcm-push": {
            if (usedDeviceIds.has(subscription.deviceId)) {
              this.state.log(
                5,
                `Skipping FCM notification to device ${subscription.deviceId} as already used`
              );
            } else {
              await this.fcmPush(notification, subscription);
              usedDeviceIds.add(subscription.deviceId);
            }
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

  public async pushSync(tableName: string) {
    if (!this.firebaseApp) {
      this.state.log(5, "Firebase app not initialized");
    } else {
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
            const messageId = await admin.messaging(this.firebaseApp).send({
              token: userSub.token,
              data: { type: "push_sync", table: tableName },
            });
            pushedDeviceIds.add(userSub.deviceId);
            this.state.log(5, `Sync push sent successfully: ${messageId}`);
          } catch (error) {
            this.state.log(5, `Error sending sync push: ${error}`);
          }
        }
      }
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

  private async fcmPush(notification: Notification, sub: FcmSubscription) {
    this.state.log(5, "Sending FCM notification");
    if (!this.firebaseJsonPath) throw new Error("Firebase config file not set");
    else if (!this.firebaseApp) {
      throw new Error("Firebase app not initialized");
    } else {
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

  private async initFCMApp() {
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
        credential: admin.credential.cert(this.firebaseJsonContent),
      },
      appName
    );
    this.firebaseApp = app;
    this.state.log(5, `Initialized Firebase app: ${appName}`);
  }
}
