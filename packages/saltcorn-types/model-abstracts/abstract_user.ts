export interface AbstractUser {
  email?: string;
  role_id: number;
  id?: number;
  [k: string]: any;
}

export interface ForUserRequest {
  forUser?: AbstractUser;
  forPublic?: boolean;
}
