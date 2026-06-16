import apiClient, { API_BASE } from './client';
import type { Article, ArticleImage, ArticleComment } from '../types';

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

export const uploadArticleImages = async (articleId: number, files: File[]): Promise<ArticleImage[]> => {
  const form = new FormData();
  files.forEach(f => form.append('images', f));
  const res = await apiClient.post(`/articles/${articleId}/images/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const deleteArticleImage = async (articleId: number, imageId: number): Promise<void> => {
  await apiClient.delete(`/articles/${articleId}/images/${imageId}`);
};

export const searchArticles = async (q: string): Promise<Article[]> => {
  const res = await apiClient.get('/articles/search', { params: { q } });
  return res.data;
};

export const getArticleComments = async (articleId: number): Promise<ArticleComment[]> => {
  const res = await apiClient.get(`/articles/${articleId}/comments`);
  return res.data;
};

export const postArticleComment = async (articleId: number, content: string): Promise<ArticleComment> => {
  const res = await apiClient.post(`/articles/${articleId}/comments`, { content });
  return res.data;
};

export const deleteArticleComment = async (articleId: number, commentId: number): Promise<void> => {
  await apiClient.delete(`/articles/${articleId}/comments/${commentId}`);
};

export const uploadCoverImage = async (file: File): Promise<string> => {
  const form = new FormData();
  form.append('image', file);
  const res = await apiClient.post('/articles/upload-cover', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const url: string = res.data.url;
  // 後端回傳相對路徑時，補上 Railway 後端域名，確保圖片從正確主機載入
  return url.startsWith('/') ? `${API_BASE}${url}` : url;
};
