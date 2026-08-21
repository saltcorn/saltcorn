/**
 * SMS sending
 * @category saltcorn-data
 * @module models/sms
 * @subcategory models
 */
import { getState } from "../db/state.js";
import fetchLib from "node-fetch";
const fetch: any = fetchLib; // NodeNext default-import interop for node-fetch

/**
 * Result of a send SMS attempt
 */
type SmsResult = {
  success: boolean;
  sid?: string;
};

/**
 * Send an SMS message via the Twilio Messages API
 * @param to recipient phone number, in E.164 format
 * @param body message text
 */
const sendViaTwilio = async (to: string, body: string): Promise<SmsResult> => {
  const accountSid = getState()!.getConfig("twilio_account_sid");
  const authToken = getState()!.getConfig("twilio_auth_token");
  const from = getState()!.getConfig("twilio_from_number");
  if (!accountSid || !authToken || !from)
    throw new Error(
      "Twilio SMS is not configured. Set Account SID, Auth token and From number in Settings > SMS."
    );
  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    }
  );
  const json: any = await resp.json();
  if (!resp.ok)
    throw new Error(json?.message || `Twilio error (HTTP ${resp.status})`);
  return { success: true, sid: json.sid };
};

/**
 * Send an SMS message via a user-configured generic webhook.
 * Saltcorn POSTs JSON <code>{ to, body }</code> to the configured URL.
 * @param to recipient phone number
 * @param body message text
 */
const sendViaWebhook = async (to: string, body: string): Promise<SmsResult> => {
  const url = getState()!.getConfig("sms_webhook_url");
  if (!url)
    throw new Error(
      "SMS webhook URL is not configured. Set it in Settings > SMS."
    );
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, body }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`SMS webhook error (HTTP ${resp.status}): ${text}`);
  }
  return { success: true };
};

/**
 * Send an SMS message using the configured SMS provider (Settings > SMS)
 * @param to recipient phone number
 * @param body message text
 */
const sendSMS = async (to: string, body: string): Promise<SmsResult> => {
  const provider = getState()!.getConfig("sms_provider") || "Twilio";
  if (provider === "Generic webhook") return await sendViaWebhook(to, body);
  return await sendViaTwilio(to, body);
};

export { sendSMS };
