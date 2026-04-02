import apiClient from './client';
import type { AdPlacement } from '../types';

export const getAds = async (position?: string): Promise<AdPlacement[]> => {
  const res = await apiClient.get('/ads', { params: position ? { position } : undefined });
  return res.data;
};

export const createAd = async (payload: Partial<AdPlacement>): Promise<AdPlacement> => {
  const res = await apiClient.post('/ads', payload);
  return res.data;
};

export const updateAd = async (id: number, payload: Partial<AdPlacement>): Promise<AdPlacement> => {
  const res = await apiClient.put(`/ads/${id}`, payload);
  return res.data;
};
