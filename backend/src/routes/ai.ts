import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifyToken, requireRole } from '../middleware/auth';

const router = Router();

// POST /api/v1/ai/generate-article  [editor+]
router.post('/generate-article', verifyToken, requireRole('editor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { title, category, key_points, style = 'news' } = req.body;

  if (!title || !category) {
    res.status(400).json({ message: '標題與分類為必填' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ message: 'AI 功能尚未設定，請聯絡管理員設定 GEMINI_API_KEY' });
    return;
  }

  const categoryName: Record<string, string> = {
    CPBL: '中華職棒', NPB: '日本職棒', MLB: '美國職棒', NBA: '美國職籃',
    '田徑': '田徑', '三級棒球': '台灣三級棒球', '足球': '足球', '籃球': '籃球', '其他': '其他體育',
  };
  const catLabel = categoryName[category] ?? category;

  const styleGuide: Record<string, string> = {
    news: '新聞報導風格：客觀、簡潔、資訊密度高，第一段為倒金字塔式導言',
    feature: '深度報導風格：有分析觀點、引用數據、有溫度的文字',
    recap: '賽後報導風格：強調比賽過程、關鍵時刻、球員表現',
  };
  const styleDesc = styleGuide[style] ?? styleGuide.news;

  const pointsText = key_points?.trim()
    ? `\n\n撰寫時請涵蓋以下重點：\n${key_points}`
    : '';

  const prompt = `你是一名專業的台灣體育新聞記者，請用繁體中文撰寫一篇關於「${title}」的 ${catLabel} 新聞文章。

撰寫規範：
- ${styleDesc}
- 字數：500–800 字
- 使用 Markdown 格式（標題用 ##，重要數據或球員名稱可用 **粗體**）
- 語氣專業但易讀，適合台灣體育迷閱讀
- 第一段直接進入主題，不要有「本文將介紹…」等廢話
- 結尾可加入對後續賽事的展望${pointsText}

請直接輸出文章本文（不要輸出 JSON、不要加前言說明）：`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const content = result.response.text();

    const firstPara = content.split('\n').find(l => l.trim().length > 20 && !l.startsWith('#')) ?? '';
    const summary = firstPara.replace(/\*\*/g, '').substring(0, 120);

    res.json({ content, summary, title });
  } catch (err: unknown) {
    console.error('AI generate error:', err);
    const msg = err instanceof Error ? err.message : '生成失敗';
    res.status(500).json({ message: `AI 生成失敗：${msg}` });
  }
});

export default router;
