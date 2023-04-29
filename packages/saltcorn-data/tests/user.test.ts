import db from "../db/index";
import User from "../models/user";
import Table from "../models/table";
import Field from "../models/field";
import {
  assertIsSet,
  assertsIsSuccessMessage,
  assertsObjectIsUser,
  assertIsErrorMsg,
} from "./assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

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
    assertIsSet(u);
    expect(u.email).toBe("foo@bar.com");
    expect(u.password === "YEgege46gew").toBe(false);
    const hasu = await User.nonEmpty();
    expect(hasu).toBe(true);
  });
  it("should not create with common pw", async () => {
    const res = await User.create({
      email: "foo2@bar.com",
      password: "passw0rd",
    });
    assertIsErrorMsg(res);
    expect(!!res.error).toBe(true);
  });
  it("should authenticate", async () => {
    const u = await User.authenticate({
      email: "foo@bar.com",
      password: "YEgege46gew",
    });
    assertIsSet(u);

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
  it("should survive nonexistant fields", async () => {
    const u = await User.authenticate({
      email: "foo@bar.com",
      password: "YEgege46gew",
      stuff: 4,
    });
    assertIsSet(u);
  });

  it("should reset password", async () => {
    const u = await User.findOne({ email: "foo@bar.com" });
    assertIsSet(u);
    expect(u.session_object.email).toBe("foo@bar.com");
    const token = await u.getNewResetToken();
    expect(token.length > 10).toBe(true);
    const res0 = await User.resetPasswordWithToken({
      email: u.email,
      reset_password_token: token,
      password: "passw0rd",
    });
    assertsIsSuccessMessage(res0);
    expect(!!res0.success).toBe(false);
    const res = await User.resetPasswordWithToken({
      email: u.email,
      reset_password_token: token,
      password: "newpaass",
    });
    assertsIsSuccessMessage(res);
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
    const res1 = await User.resetPasswordWithToken({
      email: u.email,
      reset_password_token: "somerandomtoken",
      password: "newpaass",
    });
    expect(res1).toEqual({ error: "User not found or expired token" });
    const res2 = await User.resetPasswordWithToken({
      email: u.email,
      reset_password_token: "",
      password: "newpaass",
    });
    expect(res2).toEqual({
      error: "Invalid token or invalid token length or incorrect email",
    });
  });
  it("should reset API token", async () => {
    const u = await User.findOne({ email: "foo@bar.com" });
    assertIsSet(u);
    const token = await u.getNewAPIToken();
    expect(token.length > 5).toBe(true);
    const u1 = await User.findOne({ email: "foo@bar.com" });
    assertIsSet(u1);
    expect(u1.api_token).toEqual(token);
    await u1.getNewAPIToken();
    const u2 = await User.findOne({ email: "foo@bar.com" });
    assertIsSet(u2);
    expect(u2.api_token).not.toEqual(token);
  });
  it("should set language ", async () => {
    const u = await User.findOne({ email: "foo@bar.com" });
    assertIsSet(u);
    await u.set_language("fr");
  });
  it("should generate password ", async () => {
    const rndpass = User.generate_password();
    expect(typeof rndpass).toBe("string");
    expect(rndpass.length).toBeGreaterThan(9);
  });
  it("should validate email", async () => {
    expect(User.valid_email("foobar")).toBe(false);
    expect(User.valid_email("foo@bar.com")).toBe(true);
    expect(User.valid_email(`{email:"foo@bar.com"}`)).toBe(false);
  });

  it("should verify with token", async () => {
    await getState().setConfig("elevate_verified", "4");

    const u = await User.findOne({ email: "foo@bar.com" });
    assertIsSet(u);
    await u.update({ verification_token: "foobarbazfoobarbaz" });
    expect(!!u.verified_on).toBe(false);
    const res1 = await User.verifyWithToken({
      email: "foo@bar.com",
      verification_token: "foobar",
    });
    assertIsErrorMsg(res1);
    expect(res1.error).toBe("Invalid token");
    const res2 = await User.verifyWithToken({
      email: "foo@bar.com",
      verification_token: "foobarbazfoobarbaz",
    });
    expect(res2).toBe(true);
    const u2 = await User.findOne({ email: "foo@bar.com" });
    assertIsSet(u2);
    expect(!!u2.verified_on).toBe(true);
    expect(u2.role_id).toBe(4);
  });
  it("should count", async () => {
    const n = await User.count();
    expect(n).toBeGreaterThan(2);
    expect(n).toBeLessThan(20);
  });
  it("should delete", async () => {
    const u = await User.findOne({ email: "foo@bar.com" });
    assertIsSet(u);
    await u.delete();
    const us = await User.find({ email: "foo@bar.com" });
    expect(us.length).toBe(0);
  });
  it("should find or create by attribute ", async () => {
    await getState().setConfig("email_mask", "yahoo.com");

    const u = await User.findOrCreateByAttribute("googleId", 5, {
      email: "tom@yahoo.com",
    });
    assertsObjectIsUser(u);
    expect(typeof u.password).toBe("string");
    const u1 = await User.findOrCreateByAttribute("googleId", 5);
    assertsObjectIsUser(u1);
    expect(u.id).toEqual(u1.id);
    expect(u1.email).toBe("tom@yahoo.com");
    const res = await User.findOrCreateByAttribute("googleId", 7, {
      email: "tomn@hey.com",
    });
    expect(res).toBe(false);
    await getState().setConfig("new_user_form", "some_user_view");
    const u2 = await User.findOrCreateByAttribute("googleId", 9, {
      email: "foobar@yahoo.com",
    });
    assertsObjectIsUser(u2);
    expect(!!u2.id).toBe(false);
    await getState().setConfig("new_user_form", "");
  });
});

describe("User fields", () => {
  it("should add fields", async () => {
    const table = await Table.findOne({ name: "users" });
    assertIsSet(table);
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
    assertsObjectIsUser(u);
    expect(u.email).toBe("foo1@bar.com");
    expect(u.role_id).toBe(8);
    expect(u.height).toBe(183);
    expect(u.password === "YEge56FGew").toBe(false);
    const ut = await table.getRow({ id: u.id });
    assertIsSet(ut);
    expect(ut.email).toBe("foo1@bar.com");
    expect(ut.height).toBe(183);
  });
});
describe("User join fields and aggregations in ownership", () => {
  it("should use join fields in ownership", async () => {
    // user to patient join field
    const users = Table.findOne({ name: "users" });
    assertIsSet(users);
    await Field.create({
      table: users,
      label: "cares_for",
      type: "Key to patients",
    });
    const patients = Table.findOne({ name: "patients" });
    assertIsSet(patients);
    await patients.update({ ownership_formula: "user.cares_for.id===id" });

    const patientRows = await patients.getRows({});

    await User.create({
      email: "foo7@bar.com",
      password: "YEgg4t6FGew",
      cares_for: patientRows[0].id,
    });
    const u = await User.authenticate({
      email: "foo7@bar.com",
      password: "YEgg4t6FGew",
    });
    expect((u as User).cares_for?.id).toBe(patientRows[0].id);
    expect(patients.is_owner(u, patientRows[0])).toBe(true);
    expect(patients.is_owner(u, patientRows[1])).toBe(false);
  });
  it("should use aggregation in ownership", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    await Field.create({
      table: books,
      label: "editor",
      type: "Key to users",
    });
    const users = Table.findOne({ name: "users" });
    assertIsSet(users);
    const u0 = (await User.create({
      email: "foo8@bar.com",
      password: "YEgklFGew",
    })) as User;
    const bookRows = await books.getRows({});
    await books.updateRow({ editor: u0.id }, bookRows[0].id);
    await books.update({
      min_role_read: 1,
      min_role_write: 1,
      ownership_formula: "user.books_by_editor.map(b=>b.id).includes(id)",
    });

    const u = await User.authenticate({
      email: "foo8@bar.com",
      password: "YEgklFGew",
    });
    expect(books.is_owner(u, bookRows[0])).toBe(true);
    expect(books.is_owner(u, bookRows[1])).toBe(false);
  });
});
