import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import ArticleDetail from '../components/ArticleDetail';
import { getArticleBySlug } from '../api/articles';
import type { Article } from '../types';

export default function ArticlePage() {
  const { selectedArticle, setSelectedArticle } = useApp();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [fetched, setFetched] = useState<Article | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // 直接透過 slug URL 進入時，從 API 抓文章
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    getArticleBySlug(slug)
      .then(a => setFetched(a))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const article = fetched ?? selectedArticle;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-400 font-bold">
        載入中...
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-400 font-bold text-lg mb-4">找不到此文章</p>
        <button onClick={() => navigate('/')} className="text-red-600 font-black hover:underline">
          返回首頁
        </button>
      </div>
    );
  }

  if (!article) {
    navigate('/');
    return null;
  }

  return (
    <ArticleDetail
      article={article}
      onBack={() => { setSelectedArticle(null); navigate('/'); }}
    />
  );
}
