export interface AbstractUser {
  email: string;
  role_id: number;
}

export interface ForUserRequest {
  forUser?: AbstractUser;
  forPublic?: true;
}
