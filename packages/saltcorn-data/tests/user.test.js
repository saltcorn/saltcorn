const db = require("../db/index.js");
const User = require("../models/user");

const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

afterAll(db.close);

describe("User", () => {
  it("should create", async () => {
    await User.create({ email: "foo@bar.com", password: "YEgege46gew" });
    const u = await User.findOne({ email: "foo@bar.com" });
    expect(u.email).toBe("foo@bar.com");
    expect(u.password === "YEgege46gew").toBe(false);
    const hasu = await User.nonEmpty();
    expect(hasu).toBe(true);
  });
  it("should authenticate", async () => {
    const u = await User.authenticate({
      email: "foo@bar.com",
      password: "YEgege46gew",
    });
    expect(u.email).toBe("foo@bar.com");
    expect(u.checkPassword("YEgege46gew")).toBe(true);
    expect(u.checkPassword("foobar")).toBe(false);
    const hpw = await User.hashPassword("YEgege46gew");
    expect(hpw).not.toBe("YEgege46gew");
    const u0 = await User.authenticate({
      email: "foo@bar.com",
      password: "secrat",
    });
    expect(u0).toBe(false);
    const u00 = await User.authenticate({
      email: "foo@baz.com",
      password: "YEgege46gew",
    });
    expect(u00).toBe(false);
  });
  it("should reset password", async () => {
    const u = await User.findOne({ email: "foo@bar.com" });
    const token = await u.getNewResetToken();
    expect(token.length > 10).toBe(true);
    const res = await User.resetPasswordWithToken({
      email: u.email,
      reset_password_token: token,
      password: "newpaass",
    });
    expect(!!res.success).toBe(true);
    const u1 = await User.authenticate({
      email: "foo@bar.com",
      password: "YEgege46gew",
    });
    expect(!!u1).toBe(false);
    const u2 = await User.authenticate({
      email: "foo@bar.com",
      password: "newpaass",
    });
    expect(!!u2).toBe(true);
  });
  it("should delete", async () => {
    const u = await User.findOne({ email: "foo@bar.com" });
    await u.delete();
    const us = await User.find({ email: "foo@bar.com" });
    expect(us.length).toBe(0);
  });
});
