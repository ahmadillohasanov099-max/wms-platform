import type { User } from './user.types';
export interface LoginDto {
  username: string;
  password: string;
}
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}