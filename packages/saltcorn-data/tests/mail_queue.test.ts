import { createRequire } from "module";
const require = createRequire(import.meta.url);
const _sc_db_state = () => (require("../db/state.js") as any).default;
const _sc_db = () => (require("../db/index.js") as any).default;
const _sc_db_reset_schema = () => (require("../db/reset_schema.js") as any).default;
const _sc_db_fixtures = () => (require("../db/fixtures.js") as any).default;
import email from "../models/email.js";
import Notification from "../models/notification.js";
import User from "../models/user.js";
import { MailQueue } from "../models/internal/mail_queue.js";
import { afterAll, describe, it, expect, beforeAll, jest } from "@saltcorn/db-common/test_expect";
import { createTransport } from "nodemailer";
import mocks from "./mocks.js";
const { sleep } = mocks;
import { assertIsSet } from "./assertions.js";
const { getState } = _sc_db_state();
const db = _sc_db();

afterAll(db.close);
beforeAll(async () => {
  await _sc_db_reset_schema()();
  await _sc_db_fixtures()();
  const admin = await User.findOne({ email: "admin@foo.com" });
  if (admin) {
    await admin.update({ _attributes: { notify_email: true } });
  }
  await getState().setConfig("mail_throttle_per_user", 2);
  await getState().refresh_config();
});

jest.mock("nodemailer");

jest.setTimeout(600 * 1000);

const emptyNotificationsTable = async () => {
  await db.deleteWhere("_sc_notifications", {});
};

describe("Mail queue", () => {
  it("should send when there are no previous mails", async () => {
    let sentEmail: any;
    // @ts-ignore
    createTransport.mockReturnValue({
      sendMail: (email: any) => {
        sentEmail = email;
        return new Promise((resolve) => resolve(true));
      },
    });
    const notification = await Notification.create({
      title: "test A",
      created: new Date(),
      user_id: 1,
    });
    assertIsSet(notification.id);
    expect(createTransport).toHaveBeenCalledTimes(1);
    const fromDb = await Notification.findOne({ id: notification.id });
    expect(fromDb?.send_status).toBe("sent");
  });

  it("should schedule when the min interval has not passed", async () => {
    await emptyNotificationsTable();
    let sentEmail: any;
    // @ts-ignore
    createTransport.mockClear();
    // @ts-ignore
    createTransport.mockReturnValue({
      sendMail: (email: any) => {
        sentEmail = email;
        return new Promise((resolve) => resolve(true));
      },
    });
    const minDelay = getState().getConfig("mail_throttle_per_user", 30) * 1000;
    expect(minDelay).toBe(2000);

    const notificationA = await Notification.create({
      title: "title A",
      created: new Date(),
      user_id: 1,
    });
    assertIsSet(notificationA.id);
    const fromDbA = await Notification.findOne({ id: notificationA.id });
    expect(fromDbA?.send_status).toBe("sent");
    expect(createTransport).toHaveBeenCalledTimes(1);

    const notificationB = await Notification.create({
      title: "title B",
      created: new Date(),
      user_id: 1,
    });
    assertIsSet(notificationB.id);
    let fromDbB = await Notification.findOne({ id: notificationB.id });
    expect(fromDbB?.send_status).toBe("pending");

    await sleep(minDelay + 500);
    fromDbB = await Notification.findOne({ id: notificationB.id });
    expect(fromDbB?.send_status).toBe("sent");
    expect(createTransport).toHaveBeenCalledTimes(2);
  });

  it("should send when the min interval has passed", async () => {
    await emptyNotificationsTable();
    let sentEmail: any;
    // @ts-ignore
    createTransport.mockClear();
    // @ts-ignore
    createTransport.mockReturnValue({
      sendMail: (email: any) => {
        sentEmail = email;
        return new Promise((resolve) => resolve(true));
      },
    });
    const minDelay = getState().getConfig("mail_throttle_per_user", 30) * 1000;
    expect(minDelay).toBe(2000);

    const notificationA = await Notification.create({
      title: "title A",
      created: new Date(Date.now() - minDelay - 1000),
      user_id: 1,
    });
    assertIsSet(notificationA.id);
    const fromDbA = await Notification.findOne({ id: notificationA.id });
    expect(fromDbA?.send_status).toBe("sent");
    expect(createTransport).toHaveBeenCalledTimes(1);

    await sleep(minDelay + 1);

    const notificationB = await Notification.create({
      title: "title B",
      created: new Date(),
      user_id: 1,
    });
    assertIsSet(notificationB.id);
    let fromDbB = await Notification.findOne({ id: notificationB.id });
    expect(fromDbB?.send_status).toBe("sent");
    expect(createTransport).toHaveBeenCalledTimes(2);
  });
});
