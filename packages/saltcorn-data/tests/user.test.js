const db = require("../db/index.js");
const User = require("../models/user");
const Table = require("../models/table");
const Field = require("../models/field");

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
  it("should reset password", async () => {
    const u = await User.findOne({ email: "foo@bar.com" });
    const token = await u.getNewAPIToken();
    expect(token.length > 5).toBe(true);
    const u1 = await User.findOne({ email: "foo@bar.com" });
    expect(u1.api_token).toEqual(token);
    await u1.getNewAPIToken();
    const u2 = await User.findOne({ email: "foo@bar.com" });
    expect(u2.api_token).not.toEqual(token);
  });
  it("should delete", async () => {
    const u = await User.findOne({ email: "foo@bar.com" });
    await u.delete();
    const us = await User.find({ email: "foo@bar.com" });
    expect(us.length).toBe(0);
  });
});

describe("User fields", () => {
  it("should add fields", async () => {
    const table = await Table.findOne({ name: "users" });
    const fc = await Field.create({
      table,
      label: "Height",
      type: "Integer",
    });
    await User.create({
      email: "foo1@bar.com",
      password: "YEge56FGew",
      height: 183,
    });
    const u = await User.authenticate({
      email: "foo1@bar.com",
      password: "YEge56FGew",
    });
    expect(u.email).toBe("foo1@bar.com");
    expect(u.role_id).toBe(8);
    expect(u.height).toBe(undefined);
    expect(u.password === "YEge56FGew").toBe(false);
    const ut = await table.getRow({ id: u.id });
    expect(ut.email).toBe("foo1@bar.com");
    expect(ut.height).toBe(183);
  });
});
