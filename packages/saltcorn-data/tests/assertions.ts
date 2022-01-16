import { SuccessMessage, Type } from "@saltcorn/types/common_types";
import User from "../models/user";

export function assertIsSet(object: any): asserts object {
  expect(object).not.toBeNull();
  expect(object).toBeDefined();
}

export function assertsObjectIsUser(object: any): asserts object is User {
  assertIsSet(object);
  expect(!("error" in object));
  expect("email" in object && "password" in object);
}

export function assertIsErrorsMsg(
  object: any
): asserts object is { errors: any } {
  assertIsSet(object);
  expect("errors" in object);
}

export function assertIsErrorMsg(
  object: any
): asserts object is { error: any } {
  assertIsSet(object);
  expect("error" in object);
}

export function assertsIsSuccessMessage(
  object: any
): asserts object is SuccessMessage {
  assertIsSet(object);
  expect("success" in object);
}

export function assertIsType(object: any): asserts object is Type {
  assertIsSet(object);
  expect(typeof object !== "string");
}
