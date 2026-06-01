export const config = {
  matcher: ['/article/:path*'],
};

export default async function middleware(request: Request) {
  const ua = request.headers.get('user-agent') ?? '';
  const isBot = /Twitterbot|facebookexternalhit|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Discordbot|Googlebot/i.test(ua);

  if (!isBot) return; // 一般瀏覽器，讓 SPA 自行處理

  const url = new URL(request.url);
  const slug = url.pathname.replace(/^\/article\//, '');
  if (!slug) return;

  const BACKEND = process.env.VITE_API_BASE_URL ?? '';
  try {
    const res = await fetch(`${BACKEND}/api/v1/articles/${slug}`);
    if (!res.ok) return;
    const a = await res.json();

    const esc = (s: string) =>
      (s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const title = esc(a.title ?? '水牛體育');
    const desc  = esc(a.summary ?? a.title ?? '台灣最即時的體育新聞平台');
    const img   = a.image_url ?? '';
    const canonical = url.href;

    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>${title} — 水牛體育</title>
<meta name="description" content="${desc}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
${img ? `<meta property="og:image" content="${img}">` : ''}
<meta property="og:site_name" content="水牛體育 SPORTS BUFFALO">
<meta property="og:locale" content="zh_TW">
<meta name="twitter:card" content="summary">
<meta name="twitter:site" content="@sportsbuffalotw">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
${img ? `<meta name="twitter:image" content="${img}">` : ''}
</head>
<body>
<h1>${title}</h1>
<p>${desc}</p>
</body>
</html>`;

    return new Response(html, {
      headers: { 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public,max-age=60' },
    });
  } catch {
    return;
  }
}
