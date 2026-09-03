/**
 * @category saltcorn-types
 * @module model-abstracts/abstract_user
 * @subcategory model-abstracts
 */

/** A logged-in (or loggable) Saltcorn user. */
export interface AbstractUser {
  email?: string;
  role_id: number;
  id?: number;
  [k: string]: any;
}

/** Carries the user (or Public) a request should be evaluated as. */
export interface ForUserRequest {
  forUser?: AbstractUser;
  forPublic?: boolean;
}
