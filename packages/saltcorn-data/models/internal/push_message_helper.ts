import state from "../../db/state";
import db from "../../db";
import webpush from "web-push";
import admin from "firebase-admin";
import File from "../file";
import utils from "../../utils";
import type Notification from "../notification";

const { getState } = state;
const { getSafeBaseUrl } = utils;

// Web Push
export type WebPushSubscription = {
  type: "web-push";
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

// FCM Token
export type FcmSubscription = {
  type: "fcm-push";
  token: string;
};

export type Subscription = WebPushSubscription | FcmSubscription;

/**
 * PushMessageHelper Class
 * @category saltcorn-data
 * @module models/internal/push_message_helper
 * @subcategory models
 */
export class PushMessageHelper {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidEmail: string;
  firebaseJsonPath: string;
  icon: string;
  badge: string;
  subscriptions: any;

  constructor(subscriptions: Subscription[]) {
    const state = getState();
    if (!state) throw new Error("State not initialized");
    this.icon = state.getConfig("push_notification_icon");
    this.badge = state.getConfig("push_notification_badge");
    this.vapidPublicKey = state.getConfig("vapid_public_key");
    this.vapidPrivateKey = state.getConfig("vapid_private_key");
    this.vapidEmail = state.getConfig("vapid_email");
    this.firebaseJsonPath = state.getConfig("firebase_json_key");
    this.subscriptions = subscriptions;
  }

  /**
   * Sends a notification to all subscriptions.
   * @param {Notification} notification - The notification to send.
   */
  public async send(notification: Notification) {
    for (const subscription of this.subscriptions) {
      try {
        switch (subscription.type) {
          case "fcm-push": {
            if (!this.firebaseJsonPath)
              throw new Error("Firebase config file not set");
            getState()?.log(5, "Sending FCM notification");
            await this.sendFCMPush(notification, subscription);
            break;
          }
          case "web-push":
          default: {
            if (
              !(this.vapidPublicKey && this.vapidPrivateKey && this.vapidEmail)
            )
              throw new Error("VAPID not configured");
            getState()?.log(
              5,
              `Sending web push notification to ${subscription.endpoint}`
            );
            await this.sendWebPush(notification, subscription);
            break;
          }
        }
      } catch (error) {
        getState()?.log(1, `Error sending push notification: ${error}`);
      }
    }
  }

  private async sendWebPush(
    notification: Notification,
    sub: WebPushSubscription
  ) {
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

  private async sendFCMPush(notification: Notification, sub: FcmSubscription) {
    const app = await this.getFcmApp();
    const notificationData: any = {
      title: notification.title,
      body: notification.body,
    };
    if (this.icon) {
      const baseUrl = getSafeBaseUrl();
      if (baseUrl) notificationData.imageUrl = `${baseUrl}/${this.icon}`;
    }
    const messageId = await admin.messaging(app).send({
      token: sub.token,
      notification: notificationData,
    });
    getState()?.log(5, `FCM notification sent successfully: ${messageId}`);
  }

  private async getFcmApp() {
    const appName = `${db.getTenantSchema()}_fcm_app`;
    try {
      return admin.app(appName);
    } catch (error) {
      const fireBaseFile = await File.findOne({ name: this.firebaseJsonPath });
      if (!fireBaseFile)
        throw new Error(
          `Firebase configuration file ${this.firebaseJsonPath} not found`
        );
      return admin.initializeApp(
        {
          credential: admin.credential.cert(require(fireBaseFile.absolutePath)),
        },
        appName
      );
    }
  }
}
