import React, { useState } from 'react';
import { ArrowLeft, Calendar, Tag, X, ChevronLeft, ChevronRight } from 'lucide-react';
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

  // Build full image list for lightbox: hero + additional images
  const extraImages = article.images ?? [];
  const allImages = [
    ...(article.image_url ? [article.image_url] : []),
    ...extraImages.map(img => img.image_url),
  ];

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      {lightboxOpen && allImages.length > 0 && (
        <Lightbox images={allImages} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />
      )}

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Back */}
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-gray-400 hover:text-black font-black transition"
        >
          <ArrowLeft className="w-5 h-5" />
          返回
        </button>

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
          <Markdown remarkPlugins={[remarkGfm]}>
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
