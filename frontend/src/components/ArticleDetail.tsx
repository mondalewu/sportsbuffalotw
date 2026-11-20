import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Calendar, Tag, X, ChevronLeft, ChevronRight, Link2, Check } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Article } from '../types';
import { useApp } from '../context/AppContext';
import ArticleComments from './ArticleComments';
import RelatedArticles from './RelatedArticles';
import ArticleFloatingActions from './ArticleFloatingActions';
import { getArticleComments } from '../api/articles';

interface Props {
  article: Article;
  onBack: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  CPBL: 'bg-blue-600',
  NPB: 'bg-red-700',
  MLB: 'bg-blue-900',
  NBA: 'bg-orange-600',
  WBC: 'bg-indigo-700',
  其他: 'bg-gray-600',
};

interface LightboxProps {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

function Lightbox({ images, initialIndex, onClose }: LightboxProps) {
  const [idx, setIdx] = useState(initialIndex);
  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>

      {images.length > 1 && (
        <button
          className="absolute left-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition"
          onClick={e => { e.stopPropagation(); prev(); }}
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
      )}

      <img
        src={images[idx]}
        alt=""
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      />

      {images.length > 1 && (
        <button
          className="absolute right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition"
          onClick={e => { e.stopPropagation(); next(); }}
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-4 text-white text-sm font-bold bg-black/50 px-3 py-1 rounded-full">
          {idx + 1} / {images.length}
        </div>
      )}
    </div>
  );
}

// 將內容中的社群網站裸 URL 轉換為 embed HTML
// 條件：不在 markdown 連結語法 [text](url) 裡面
function injectSocialEmbeds(content: string): string {
  return content
    .replace(
      /(?<!\()(https?:\/\/(twitter\.com|x\.com)\/\S+\/status\/\d+[^\s)\]]*)/g,
      (_, url) =>
        `\n<blockquote class="twitter-tweet"><a href="${url}">${url}</a></blockquote>\n`,
    )
    .replace(
      /(?<!\()(https?:\/\/www\.threads\.(net|com)\/@[\w.]+\/post\/[^\s)\]]+)/g,
      (_, url) =>
        `\n<blockquote class="text-post-media" data-text-post-permalink="${url}"><a href="${url}">${url}</a></blockquote>\n`,
    );
}

export default function ArticleDetail({ article, onBack }: Props) {
  const { currentUser, setAuthModal } = useApp();
  const categoryColor = CATEGORY_COLORS[article.category] ?? 'bg-gray-600';
  const dateStr = article.published_at
    ? new Date(article.published_at).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  // Build full image list for lightbox
  const extraImages = article.images ?? [];
  const contentImageUrls = [...(article.content?.matchAll(/!\[.*?\]\((https?:\/\/[^)]+)\)/g) ?? [])]
    .map(m => m[1]);
  const seenUrls = new Set<string>();
  const allImages: string[] = [];
  for (const url of [
    ...(article.image_url ? [article.image_url] : []),
    ...contentImageUrls,
    ...extraImages.map(img => img.image_url),
  ]) {
    if (!seenUrls.has(url)) { seenUrls.add(url); allImages.push(url); }
  }

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const commentsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getArticleComments(article.id)
      .then(c => setCommentCount(c.length))
      .catch(() => {});
  }, [article.id]);

  const scrollToComments = () => {
    commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // 載入 Instagram embed.js（若文章有 IG 貼文 URL）
  useEffect(() => {
    if (!article.ig_embed_url) return;
    const isPost = /instagram\.com\/(p|reel|tv)\//.test(article.ig_embed_url);
    if (!isPost) return;

    if ((window as any).instgrm?.Embeds) {
      (window as any).instgrm.Embeds.process();
      return;
    }

    const existing = document.getElementById('instagram-embed-script');
    if (existing) {
      existing.addEventListener('load', () => (window as any).instgrm?.Embeds?.process());
      return;
    }

    const script = document.createElement('script');
    script.id = 'instagram-embed-script';
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    script.onload = () => (window as any).instgrm?.Embeds?.process();
    document.head.appendChild(script);
  }, [article.ig_embed_url, article.id]);

  // 載入 Twitter/X widget script（若文章含有 X embed）
  useEffect(() => {
    const hasTwitterEmbed = article.content?.includes('twitter-tweet') ||
                            article.content?.includes('twitter.com') ||
                            article.content?.includes('x.com/') ;
    if (!hasTwitterEmbed) return;

    if ((window as any).twttr?.widgets) {
      (window as any).twttr.widgets.load();
      return;
    }

    const existing = document.getElementById('twitter-widget-script');
    if (existing) {
      existing.addEventListener('load', () => {
        (window as any).twttr?.widgets?.load();
      });
      return;
    }

    const script = document.createElement('script');
    script.id = 'twitter-widget-script';
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.onload = () => (window as any).twttr?.widgets?.load();
    document.head.appendChild(script);
  }, [article.content, article.id]);

  // 載入 Threads embed script（若文章含有 Threads embed）
  useEffect(() => {
    const hasThreadsEmbed = article.content?.includes('threads.net/') ||
                            article.content?.includes('threads.com/');
    if (!hasThreadsEmbed) return;

    const loadAndProcess = () => {
      const existing = document.getElementById('threads-embed-script');
      if (existing) {
        // script 已存在，移除後重新插入以觸發處理
        existing.remove();
      }
      const script = document.createElement('script');
      script.id = 'threads-embed-script';
      script.src = 'https://www.threads.net/embed/post.js';
      script.async = true;
      document.head.appendChild(script);
    };

    // React 渲染後再載入，確保 blockquote 已在 DOM 中
    const timer = setTimeout(loadAndProcess, 100);
    return () => clearTimeout(timer);
  }, [article.content, article.id]);

  const pageUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/article/${article.slug}`
    : '';
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedTitle = encodeURIComponent(article.title);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(pageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {lightboxOpen && allImages.length > 0 && (
        <Lightbox images={allImages} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />
      )}

      <ArticleFloatingActions
        articleId={article.id}
        commentCount={commentCount}
        onScrollToComments={scrollToComments}
      />

      <main className="max-w-4xl mx-auto px-4 py-8 pb-20 lg:pb-8">
        {/* Back + Share */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-black font-black transition"
          >
            <ArrowLeft className="w-5 h-5" />
            返回
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              title="複製連結"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 text-xs font-bold transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Link2 className="w-3.5 h-3.5" />}
              {copied ? '已複製' : '複製連結'}
            </button>

            {/* LINE */}
            <a
              href={`https://social-plugins.line.me/lineit/share?url=${encodedUrl}`}
              target="_blank" rel="noopener noreferrer"
              title="分享到 LINE"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-[#06C755] hover:bg-[#05a847] transition"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
            </a>

            {/* X (Twitter) */}
            <a
              href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
              target="_blank" rel="noopener noreferrer"
              title="分享到 X"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-black hover:bg-gray-800 transition"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>

            {/* Threads */}
            <a
              href={`https://www.threads.net/intent/post?text=${encodeURIComponent(`${article.title}\n${pageUrl}`)}`}
              target="_blank" rel="noopener noreferrer"
              title="分享到 Threads"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-black hover:bg-gray-800 transition border border-gray-200"
            >
              <svg viewBox="0 0 192 192" className="w-4 h-4 fill-white">
                <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.24-38.37 34.76.384 9.812 5.08 18.253 13.22 23.768 6.88 4.66 15.736 7.016 24.924 6.635 12.14-.503 21.647-5.175 28.263-13.882 5.022-6.613 8.188-15.14 9.6-25.916 5.754 3.472 10.034 8.082 12.467 13.72 4.08 9.46 4.322 25.03-7.264 36.615-10.189 10.182-22.44 14.583-40.896 14.72-20.432-.153-35.886-6.713-45.924-19.498C65.49 142.603 59.816 125.273 59.63 105c.186-20.273 5.86-37.604 16.874-51.504C86.541 40.712 102 34.153 122.432 34c20.6.157 36.213 6.804 46.374 19.756C178.657 65.633 183.882 82.206 184 101.5l16.5.5c-.169-22.735-6.47-42.658-18.738-57.258C168.34 28.252 149.142 19.74 125 18h-5.25c-24.027.173-43.126 8.676-56.722 25.236C50.482 59.058 43.72 80.063 43.5 105v.5c.22 24.938 6.982 45.942 19.528 61.764C76.622 183.561 95.72 192.064 119.747 192.237h2.686c22.28-.163 39.14-6.17 51.58-18.377 16.84-16.52 17.33-37.187 11.524-50.872-4.166-9.817-12.21-17.78-23.267-23.04l-.733-.96zM99.684 130.885c-10.18.588-20.774-4.006-21.278-14.244-.368-7.49 5.313-15.84 25.473-17.003 2.228-.128 4.41-.19 6.55-.19 6.274 0 12.146.56 17.456 1.656-1.988 23.42-14.058 29.194-28.201 29.781z"/>
              </svg>
            </a>

            {/* Facebook */}
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
              target="_blank" rel="noopener noreferrer"
              title="分享到 Facebook"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1877F2] hover:bg-[#1668d3] transition"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Hero Image */}
        {article.image_url && (
          <div
            className="w-full h-72 md:h-96 overflow-hidden rounded-3xl mb-8 shadow-lg cursor-zoom-in"
            onClick={() => openLightbox(0)}
          >
            <img
              src={article.image_url}
              alt={article.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            />
          </div>
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className={`${categoryColor} text-white text-xs font-black px-3 py-1 rounded-full flex items-center gap-1`}>
            <Tag className="w-3 h-3" />
            {article.category}
          </span>
          {dateStr && (
            <span className="text-gray-400 text-sm font-bold flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {dateStr}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-black leading-tight mb-4">{article.title}</h1>

        {/* Summary */}
        {article.summary && (
          <p className="text-gray-500 text-lg leading-relaxed border-l-4 border-red-500 pl-4 mb-8 italic">
            {article.summary}
          </p>
        )}

        <hr className="border-gray-100 mb-8" />

        {/* Content — Markdown + raw HTML (for X/Twitter embeds) */}
        <div className="prose prose-lg max-w-none
          prose-headings:font-black
          prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
          prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
          prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
          prose-a:text-red-600 prose-a:font-bold hover:prose-a:underline
          prose-strong:text-black
          prose-ul:list-disc prose-ul:pl-6
          prose-ol:list-decimal prose-ol:pl-6
          prose-li:mb-1 prose-li:text-gray-700
          prose-blockquote:border-l-4 prose-blockquote:border-red-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-500
          prose-img:rounded-2xl prose-img:shadow-md
          prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-code:text-sm prose-code:font-mono
          prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-2xl prose-pre:p-4
        ">
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              img: ({ src, alt }) => {
                const idx = allImages.indexOf(src ?? '');
                return (
                  <figure className="my-4">
                    <img
                      src={src}
                      alt={alt ?? ''}
                      className="rounded-2xl shadow-md cursor-zoom-in hover:opacity-90 transition w-full"
                      onClick={() => idx >= 0 && openLightbox(idx)}
                      style={{ cursor: idx >= 0 ? 'zoom-in' : 'default' }}
                    />
                    {alt && (
                      <figcaption className="text-center text-xs text-gray-400 mt-2 italic">
                        {alt}
                      </figcaption>
                    )}
                  </figure>
                );
              },
            }}
          >
            {injectSocialEmbeds(article.content ?? '')}
          </Markdown>
        </div>

        {/* Additional Images Gallery */}
        {extraImages.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-black text-gray-700 mb-4">相關圖片</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {extraImages.map((img, i) => (
                <div key={img.id} className="flex flex-col">
                  <div
                    className="aspect-video overflow-hidden rounded-2xl shadow cursor-zoom-in bg-gray-100"
                    onClick={() => openLightbox(article.image_url ? i + 1 : i)}
                  >
                    <img
                      src={img.image_url}
                      alt={img.caption || ''}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                  {img.caption && (
                    <p className="text-xs text-gray-400 mt-1.5 px-1 text-center italic">{img.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instagram 嵌入 */}
        {article.ig_embed_url && (() => {
          const url = article.ig_embed_url!;
          const isPost = /instagram\.com\/(p|reel|tv)\//.test(url);
          if (isPost) {
            const cleanUrl = url.split('?')[0].replace(/\/$/, '') + '/';
            return (
              <div className="mt-10 flex justify-center">
                <blockquote
                  className="instagram-media"
                  data-instgrm-permalink={cleanUrl}
                  data-instgrm-version="14"
                  style={{ maxWidth: 540, width: '100%', minWidth: 326, border: 0, margin: '0 auto' }}
                >
                  <a href={cleanUrl} target="_blank" rel="noopener noreferrer"
                    className="text-red-600 underline text-sm">
                    在 Instagram 上查看
                  </a>
                </blockquote>
              </div>
            );
          }
          // 個人檔案連結 → 顯示連結卡片
          const usernameMatch = url.match(/instagram\.com\/([^/?#]+)/);
          const username = usernameMatch ? usernameMatch[1] : null;
          return (
            <div className="mt-10">
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-2xl hover:border-pink-400 hover:bg-pink-50 transition group">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
                <div>
                  {username && <p className="font-black text-gray-800 group-hover:text-pink-600 transition">@{username}</p>}
                  <p className="text-sm text-gray-400">在 Instagram 上查看個人檔案</p>
                </div>
              </a>
            </div>
          );
        })()}

        {/* 留言區 */}
        <div ref={commentsRef}>
          <ArticleComments
            articleId={article.id}
            currentUser={currentUser}
            onRequireAuth={() => setAuthModal('login')}
          />
        </div>

        {/* 相關新聞 */}
        <RelatedArticles articleId={article.id} currentCategory={article.category} />
      </main>
    </>
  );
}