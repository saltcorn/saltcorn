const { remote } = require("webdriverio");

const capabilities = {
  platformName: "Android",
  "appium:automationName": "UiAutomator2",
  "appium:deviceName": "Android",
  "appium:appPackage": "saltcorn.mobile.app",
  "appium:appActivity": ".MainActivity",
};

const wdOpts = {
  host: process.env.APPIUM_HOST || "localhost",
  port: 4723,
  logLevel: "info",
  capabilities,
};

jest.setTimeout(4000000);

let driver;
beforeAll(async () => {
  driver = await remote(wdOpts);
  await driver.switchContext("WEBVIEW_saltcorn.mobile.app");
  await driver.pause(10000);
});

afterAll(async () => {
  await driver.deleteSession();
});

describe("appium", () => {
  it("basic test", async () => {
    if (driver) {
      const iframe = await driver.$("iframe");
      await driver.switchToFrame(iframe);
      await driver.pause(10000);
      console.log(await driver.getLogs("browser"));
      const emailInput = await driver.$('input[name="email"]');
      await emailInput.setValue("user@foo.com");
      const passwordInput = await driver.$('input[name="password"]');
      await passwordInput.setValue("foobarbarfoo");
      const button = await driver.$("button");
      await button.click();
      await driver.pause(10000);   
    }
  });
});
