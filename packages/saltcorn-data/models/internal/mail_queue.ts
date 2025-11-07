const db = require("../../db");
const { getState } = require("../../db/state");

import type Notification from "models/notification";
import type User from "models/user";

const buildSingleMail = (notification: Notification, recipient: string) => {
  const state = getState();
  state.log(6, `Building single mail for notification id: '${notification.id}`);
  const email = {
    from: state?.getConfig("email_from"),
    to: recipient,
    subject: notification.title,
    text: `${notification.body}${notification.link ? `\n${notification.link}` : ""}`,
    html: `${notification.body}<br/>${
      notification.link
        ? `<a href="${notification.link}" style="color: #1a73e8;">${notification.link}</a>`
        : ""
    }`,
  };
  return email;
};

const buildCombinedMail = (
  notifications: Notification[],
  recipient: string
) => {
  const state = getState();
  state.log(
    6,
    `Building combined mail for notification ids: '${notifications.map((n) => n.id).join(", ")}'`
  );
  let combinedText = "";
  let combinedHtml = "";
  for (const notification of notifications) {
    const formattedDate = new Date(notification.created).toLocaleString(); // nice local format
    combinedText += `${formattedDate}\n${notification.title}\n${notification.body}\n${notification.link}\n\n`;
    combinedHtml += `
      <div style="margin-bottom: 1.5em; font-family: Arial, sans-serif;">
        <div style="font-size: 0.85em; color: #888;">${formattedDate}</div>
        <h2 style="margin: 0.2em 0;">${notification.title}</h2>
        <div>${notification.body}</div>
        ${
          notification.link
            ? `<div style="margin-top: 0.5em;">
          <a href="${notification.link}" style="color: #1a73e8;">${notification.link}</a>
        </div>`
            : ""
        }
      </div>
    `;
  }
  return {
    from: state?.getConfig("email_from"),
    to: recipient,
    subject: "You have new notifications",
    text: combinedText,
    html: combinedHtml,
  };
};

/**
 * Mail Queue class
 */
export class MailQueue {
  /**
   *
   * @param notification Notification
   */
  static async handleNotification(notification: Notification, user: User) {
    await db.openOrUseTransaction(async () => {
      const minDelay =
        getState().getConfig("mail_throttle_per_user", 30) * 1000;
      if (!minDelay || minDelay <= 0) {
        // send immediately
        await MailQueue.send(buildSingleMail(notification, user.email));
        await MailQueue.setSendStatus([notification.id!], "sent");
      } else {
        const rows = await MailQueue.loadNotifications(notification.user_id);
        if (rows.find((n: Notification) => n.send_status === "pending")) {
          // sending was scheduled, set to pending
          await MailQueue.setSendStatus([notification.id!], "pending");
        } else {
          // check if delay has passed or schedule the next send
          let lastSendTimestamp: Date | null = null;
          for (const row of rows) {
            if (
              row.send_status === "sent" &&
              row.created &&
              (!lastSendTimestamp || row.created > lastSendTimestamp)
            ) {
              lastSendTimestamp = row.created;
            }
          }
          const passedDelay = lastSendTimestamp
            ? new Date().valueOf() - lastSendTimestamp.valueOf()
            : Infinity;
          if (passedDelay >= minDelay) {
            // intervall passed - send now
            await MailQueue.send(buildSingleMail(notification, user.email));
            await MailQueue.setSendStatus([notification.id!], "sent");
          } else {
            // schedule
            await MailQueue.setSendStatus([notification.id!], "pending");
            MailQueue.scheduleSend(minDelay - passedDelay, user);
          }
        }
      }
    });
  }

  private static scheduleSend(delay: number, user: User) {
    setTimeout(async () => {
      return await db.whenTransactionisFree(async () => {
        const rows = await MailQueue.loadNotifications(user.id!, "pending");
        if (rows.length > 0) {
          await MailQueue.send(
            rows.length === 1
              ? buildSingleMail(rows[0], user.email)
              : buildCombinedMail(rows, user.email)
          );
          await MailQueue.setSendStatus(
            rows.map((r: Notification) => r.id!),
            "sent"
          );
        } else {
          console.log("No pending notifications for user", user.email);
        }
      });
    }, delay);
  }

  private static async loadNotifications(userId: number, sendStatus?: string) {
    const rows = await db.select(
      "_sc_notifications",
      {
        user_id: userId,
        created: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        ...(sendStatus ? { send_status: sendStatus } : {}),
      },
      { forupdate: true, orderBy: "id" }
    );
    return rows;
  }

  private static async setSendStatus(
    notificationIds: number[],
    status: "pending" | "sent" | "failed"
  ) {
    const schema = db.getTenantSchemaPrefix();
    const now = new Date();
    if (status === "sent") {
      await db.query(
        `UPDATE ${schema}_sc_notifications SET send_status=$1, created=$2 WHERE id = ANY($3)`,
        [status, now, notificationIds]
      );
    } else {
      await db.query(
        `UPDATE ${schema}_sc_notifications SET send_status=$1 WHERE id = ANY($2)`,
        [status, notificationIds]
      );
    }
  }

  private static async send(email: any) {
    const state = getState();
    const emailModule = require("../email");
    (await emailModule.getMailTransport())
      .sendMail(email)
      .catch((e: any) => state?.log(1, e.message));
  }
}
