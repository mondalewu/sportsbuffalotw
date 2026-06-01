import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
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
  const canonicalUrl = article
    ? `https://sportsbuffalotw.vercel.app/article/${article.slug}`
    : 'https://sportsbuffalotw.vercel.app';

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
    <>
      <Helmet>
        <title>{article.title} — 水牛體育</title>
        <meta name="description" content={article.summary || article.title} />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={article.summary || article.title} />
        {article.image_url && <meta property="og:image" content={article.image_url} />}
        <meta property="og:site_name" content="水牛體育 SPORTS BUFFALO" />
        <meta property="og:locale" content="zh_TW" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@sportsbuffalotw" />
        <meta name="twitter:title" content={article.title} />
        <meta name="twitter:description" content={article.summary || article.title} />
        {article.image_url && <meta name="twitter:image" content={article.image_url} />}
      </Helmet>
      <ArticleDetail
        article={article}
        onBack={() => { setSelectedArticle(null); navigate('/'); }}
      />
    </>
  );
}
