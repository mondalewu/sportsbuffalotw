import React, { useState } from 'react';
import { ArrowLeft, Calendar, Tag, X, ChevronLeft, ChevronRight, Link2, Check } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Article } from '../types';

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
      {/* Close */}
      <button
        className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Prev */}
      {images.length > 1 && (
        <button
          className="absolute left-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition"
          onClick={e => { e.stopPropagation(); prev(); }}
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
      )}

      {/* Image */}
      <img
        src={images[idx]}
        alt=""
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      />

      {/* Next */}
      {images.length > 1 && (
        <button
          className="absolute right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition"
          onClick={e => { e.stopPropagation(); next(); }}
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      )}

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute bottom-4 text-white text-sm font-bold bg-black/50 px-3 py-1 rounded-full">
          {idx + 1} / {images.length}
        </div>
      )}
    </div>
  );
}

export default function ArticleDetail({ article, onBack }: Props) {
  const categoryColor = CATEGORY_COLORS[article.category] ?? 'bg-gray-600';
  const dateStr = article.published_at
    ? new Date(article.published_at).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  // Build full image list for lightbox: hero + content images + additional images (deduped)
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

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
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

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Back + Share */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-black font-black transition"
          >
            <ArrowLeft className="w-5 h-5" />
            返回
          </button>

          {/* 分享按鈕 */}
          <div className="flex items-center gap-2">
            {/* 複製連結 */}
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

        {/* Content — supports Markdown */}
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
            components={{
              img: ({ src, alt }) => {
                const idx = allImages.indexOf(src ?? '');
                return (
                  <img
                    src={src}
                    alt={alt ?? ''}
                    className="rounded-2xl shadow-md cursor-zoom-in hover:opacity-90 transition"
                    onClick={() => idx >= 0 && openLightbox(idx)}
                    style={{ cursor: idx >= 0 ? 'zoom-in' : 'default' }}
                  />
                );
              },
            }}
          >
            {article.content}
          </Markdown>
        </div>

        {/* Additional Images Gallery */}
        {extraImages.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-black text-gray-700 mb-4">相關圖片</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {extraImages.map((img, i) => (
                <div
                  key={img.id}
                  className="aspect-video overflow-hidden rounded-2xl shadow cursor-zoom-in bg-gray-100"
                  onClick={() => openLightbox(article.image_url ? i + 1 : i)}
                >
                  <img
                    src={img.image_url}
                    alt={img.caption || ''}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                  {img.caption && (
                    <p className="text-xs text-gray-500 mt-1 px-1 truncate">{img.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
