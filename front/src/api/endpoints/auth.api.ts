import type { ChangePasswordDto, LoginDto, LoginResponse } from "../../types";
import api from "../axios";
export const authApi = {
  login: (dto: LoginDto): Promise<LoginResponse> =>
    api.post('/auth/login', dto),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me'),
  changePassword: (dto: ChangePasswordDto) =>
    api.put('/auth/change-password', dto),
  verifyPassword: (password: string): Promise<{ success: boolean }> =>
    api.post('/auth/verify-password', { password }),
};