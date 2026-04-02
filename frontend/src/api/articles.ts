import apiClient from './client';
import type { Article } from '../types';

export interface ArticlesParams {
  category?: string;
  page?: number;
  limit?: number;
}

export interface CreateArticlePayload {
  title: string;
  category: string;
  summary: string;
  content: string;
  image_url: string;
}

export const getArticles = async (params?: ArticlesParams): Promise<Article[]> => {
  const res = await apiClient.get('/articles', { params });
  return res.data;
};

export const getArticleBySlug = async (slug: string): Promise<Article> => {
  const res = await apiClient.get(`/articles/${slug}`);
  return res.data;
};

export const createArticle = async (payload: CreateArticlePayload): Promise<Article> => {
  const res = await apiClient.post('/articles', payload);
  return res.data;
};

export const updateArticle = async (id: number, payload: Partial<CreateArticlePayload>): Promise<Article> => {
  const res = await apiClient.put(`/articles/${id}`, payload);
  return res.data;
};

export const deleteArticle = async (id: number): Promise<void> => {
  await apiClient.delete(`/articles/${id}`);
};

export const fetchExternalNews = async (): Promise<Article[]> => {
  const res = await apiClient.post('/articles/fetch-external');
  return res.data;
};
