import apiClient from './client';
import type { User } from '../types';

export const register = async (payload: { email: string; username: string; password: string }): Promise<User> => {
  const res = await apiClient.post('/auth/register', payload);
  return res.data.user;
};

export const login = async (payload: { email: string; password: string }): Promise<User> => {
  const res = await apiClient.post('/auth/login', payload);
  return res.data.user;
};

export const logout = async (): Promise<void> => {
  await apiClient.post('/auth/logout');
};

export const getMe = async (): Promise<User | null> => {
  try {
    const res = await apiClient.get('/auth/me');
    return res.data;
  } catch {
    return null;
  }
};
