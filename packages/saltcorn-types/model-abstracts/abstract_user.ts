export interface AbstractUser {
  email: string;
  role_id: number;
  id: any;
}

export interface ForUserRequest {
  forUser?: AbstractUser;
  forPublic?: true;
}
