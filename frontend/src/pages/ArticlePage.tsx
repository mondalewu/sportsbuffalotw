import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import ArticleDetail from '../components/ArticleDetail';

export default function ArticlePage() {
  const { selectedArticle, setSelectedArticle } = useApp();
  const navigate = useNavigate();

  if (!selectedArticle) {
    navigate('/');
    return null;
  }

  return (
    <ArticleDetail
      article={selectedArticle}
      onBack={() => { setSelectedArticle(null); navigate('/'); }}
    />
  );
}
