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
  image_position?: string;
  ig_embed_url?: string | null;
  placement?: 'default' | 'hero' | 'featured' | 'pinned';
  status?: 'draft' | 'published';
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

export const getDrafts = async (): Promise<Article[]> => {
  const res = await apiClient.get('/articles/drafts');
  return res.data;
};

export const publishDraft = async (id: number): Promise<Article> => {
  const res = await apiClient.patch(`/articles/${id}/publish`);
  return res.data;
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

export const getRelatedArticles = async (articleId: number): Promise<Article[]> => {
  const res = await apiClient.get(`/articles/${articleId}/related`);
  return res.data;
};

export const getTrendingArticles = async (limit = 10): Promise<(Article & { week_views: number })[]> => {
  const res = await apiClient.get('/articles/trending', { params: { limit } });
  return res.data;
};

export const recordArticleView = async (articleId: number): Promise<void> => {
  await apiClient.post(`/articles/${articleId}/view`).catch(() => {});
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

// ─── 留言表情反應 ─────────────────────────────────────────────────────────────

export interface ReactionsData {
  counts: Record<string, number>;
  userReactions: string[];
}

export const getCommentReactions = async (articleId: number, commentId: number): Promise<ReactionsData> => {
  const res = await apiClient.get(`/articles/${articleId}/comments/${commentId}/reactions`);
  return res.data;
};

export const toggleCommentReaction = async (articleId: number, commentId: number, reaction: string): Promise<ReactionsData> => {
  const res = await apiClient.post(`/articles/${articleId}/comments/${commentId}/reactions`, { reaction });
  return res.data;
};

// ─── 按讚 / 收藏 ─────────────────────────────────────────────────────────────

export const getArticleLike = async (articleId: number): Promise<{ count: number; liked: boolean }> => {
  const res = await apiClient.get(`/articles/${articleId}/like`);
  return res.data;
};

export const toggleArticleLike = async (articleId: number): Promise<{ count: number; liked: boolean }> => {
  const res = await apiClient.post(`/articles/${articleId}/like`);
  return res.data;
};

export const getArticleBookmark = async (articleId: number): Promise<{ bookmarked: boolean }> => {
  const res = await apiClient.get(`/articles/${articleId}/bookmark`);
  return res.data;
};

export const toggleArticleBookmark = async (articleId: number): Promise<{ bookmarked: boolean }> => {
  const res = await apiClient.post(`/articles/${articleId}/bookmark`);
  return res.data;
};

export const getLikedArticles = async (): Promise<Article[]> => {
  const res = await apiClient.get('/articles/me/liked');
  return res.data;
};

export const getBookmarkedArticles = async (): Promise<Article[]> => {
  const res = await apiClient.get('/articles/me/bookmarked');
  return res.data;
};

// ─── Story Cards（精華 Reels）────────────────────────────────────────────────

export interface StoryCard {
  id: number;
  title: string;
  image_url: string;
  video_url?: string;
  category: string;
  link_url?: string;
  duration_ms: number;
  is_active?: boolean;
  sort_order?: number;
  created_at: string;
}

export const getStoryCards = async (): Promise<StoryCard[]> => {
  const res = await apiClient.get('/stories/cards');
  return res.data;
};

export const getStoryCardsAdmin = async (): Promise<StoryCard[]> => {
  const res = await apiClient.get('/stories/cards/admin');
  return res.data;
};

export const createStoryCard = async (payload: Partial<StoryCard>): Promise<StoryCard> => {
  const res = await apiClient.post('/stories/cards', payload);
  return res.data;
};

export const updateStoryCard = async (id: number, payload: Partial<StoryCard>): Promise<StoryCard> => {
  const res = await apiClient.put(`/stories/cards/${id}`, payload);
  return res.data;
};

export const deleteStoryCard = async (id: number): Promise<void> => {
  await apiClient.delete(`/stories/cards/${id}`);
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
