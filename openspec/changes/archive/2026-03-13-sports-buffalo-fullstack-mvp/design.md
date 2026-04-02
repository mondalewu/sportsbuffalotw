## Context

水牛體育目前是一個部署在 Google AI Studio 的 React 單頁應用，所有資料（新聞、賽程、球員名冊）皆 hardcoded 於 `App.tsx`。前端使用 Vite + React + TypeScript + Tailwind CSS，UI 設計採黑紅配色運動風格。

本次升級目標：建立生產可用的全端架構，以 Docker Compose 統一管理所有服務，讓內容編輯可透過後台 CMS 管理新聞，賽程數據由 API 驅動，並加入會員系統與廣告版位管理。

## Goals / Non-Goals

**Goals:**
- 建立 Express + TypeScript REST API 後端
- 建立 PostgreSQL 資料庫 schema（5 張核心資料表）
- Docker Compose 配置 4 個服務：frontend、backend、db、pgadmin
- 前端改為 API 呼叫，取代 hardcoded 資料
- 會員系統：JWT 認證、bcrypt 密碼雜湊
- 後台 CMS：新聞 CRUD（保留現有後台頁面風格，改為呼叫 API）
- 廣告版位系統：CPD 直售（固定版位）+ CPM 代碼嵌入

**Non-Goals:**
- 即時 WebSocket 比分（Phase 2）
- 外部體育數據 API 串接（Phase 2，本次用資料庫 seed 資料）
- 付費訂閱/金流（Phase 2）
- iOS/Android APP（Phase 3）
- 多語言（Phase 3）
- AI 新聞推薦（Phase 3）

## Decisions

### 1. 前後端分離 vs Monolith

**決定**: 前後端分離，`frontend/` 與 `backend/` 為獨立目錄

**理由**: 前端已有清晰的 React 架構，分離後可獨立部署，日後前端可遷移至 CDN。monolith 的 SSR 方案（Next.js）雖可簡化部署，但需重寫現有 Vite 前端，成本過高。

**替代方案**: Next.js fullstack → 捨棄，因現有 Vite 設定重寫成本太高

### 2. API 設計：REST vs GraphQL

**決定**: REST API，版本前綴 `/api/v1/`

**理由**: 團隊熟悉度高、實作簡單、工具鏈成熟。目前資料關係不複雜，GraphQL 的靈活性優勢不明顯，且增加後端複雜度。

### 3. 認證方案：JWT vs Session

**決定**: JWT（stateless）儲存於 httpOnly Cookie

**理由**: 適合前後端分離架構，不需 session store。httpOnly Cookie 防止 XSS 竊取 token，比 localStorage 安全。Access token 短效（15分鐘）+ Refresh token（7天）。

**替代方案**: localStorage 儲存 JWT → 捨棄，XSS 風險

### 4. 資料庫 ORM vs 原生 SQL

**決定**: 使用 `pg`（node-postgres）直接寫 SQL，搭配 migration 管理

**理由**: 專案規模 Phase 1 資料表數量少（5 張），ORM（Prisma/TypeORM）增加學習成本與 bundle 大小。直接 SQL 更易於 debug 與 DBA 理解。

**替代方案**: Prisma → 捨棄，為 Phase 1 過度工程

### 5. 廣告系統架構

**決定**: 混合策略 — 資料庫管理 CPD 版位合約，前端動態注入 CPM 聯播網代碼

**理由**: CPD 直售（如贊助商 banner）需追蹤曝光/點擊，資料庫紀錄版位與合約期限。CPM 聯播網（如 Google AdSense）透過 `<script>` 注入，後台只管理代碼字串即可。

### 6. Docker 服務設計

| 服務 | Image | Port |
|------|-------|------|
| frontend | node:20-alpine（Vite dev server） | 5173 |
| backend | node:20-alpine | 3001 |
| db | postgres:16-alpine | 5432 |
| pgadmin | dpage/pgadmin4 | 5050 |

前端 Vite proxy 設定將 `/api` 請求轉發至 backend:3001，避免 CORS 問題。

## 資料庫 Schema

```sql
-- 會員
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'member', -- member | editor | admin
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 新聞文章
CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  category VARCHAR(50) NOT NULL, -- WBC | CPBL | NPB | MLB | NBA
  summary TEXT,
  content TEXT NOT NULL,
  image_url VARCHAR(1000),
  author_id INT REFERENCES users(id),
  is_hot BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 賽程
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  league VARCHAR(50) NOT NULL,      -- CPBL | NPB | WBC
  team_home VARCHAR(100) NOT NULL,
  team_away VARCHAR(100) NOT NULL,
  score_home INT,
  score_away INT,
  status VARCHAR(20) DEFAULT 'scheduled', -- scheduled | live | final
  game_detail VARCHAR(100),               -- e.g. "4局下", "Q4 2:15"
  venue VARCHAR(200),
  game_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 積分榜
CREATE TABLE standings (
  id SERIAL PRIMARY KEY,
  league VARCHAR(50) NOT NULL,
  season VARCHAR(20) NOT NULL,
  team_name VARCHAR(100) NOT NULL,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  draws INT DEFAULT 0,
  win_rate DECIMAL(5,3),
  games_behind DECIMAL(5,1),
  rank INT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 廣告版位
CREATE TABLE ad_placements (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL,   -- CPD | CPM
  position VARCHAR(100) NOT NULL, -- hero | sidebar | article-top | article-bottom
  ad_code TEXT,                -- CPM 聯播網代碼
  client_name VARCHAR(200),    -- CPD 廣告主名稱
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API 路由設計

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me

GET    /api/v1/articles          ?category=&page=&limit=
GET    /api/v1/articles/:slug
POST   /api/v1/articles          [editor+]
PUT    /api/v1/articles/:id      [editor+]
DELETE /api/v1/articles/:id      [editor+]

GET    /api/v1/games             ?league=&status=
GET    /api/v1/standings         ?league=&season=

GET    /api/v1/ads               ?position=
POST   /api/v1/ads               [admin]
PUT    /api/v1/ads/:id           [admin]
```

## Risks / Trade-offs

- **[風險] 前端重構量大** → Mitigation：優先讓 API 可用，前端分頁面逐步遷移，保留 mock 資料作 fallback
- **[風險] Docker on Windows 效能** → Mitigation：使用 WSL2 後端，確保 Docker Desktop 開啟 WSL2 整合
- **[風險] JWT Refresh Token 複雜度** → Mitigation：Phase 1 簡化為單一 access token（24小時有效），Phase 2 再加 refresh
- **[Trade-off] 無外部 API 串接** → 接受：Phase 1 以 seed 資料展示功能，Phase 2 串接 API-Sports 或 CPBL 官方數據

## Migration Plan

1. `docker compose up -d` 啟動所有服務
2. 後端執行 `npm run migrate` 建立資料表
3. 執行 `npm run seed` 插入初始資料（現有 hardcoded 資料轉為 SQL）
4. 前端環境變數設定 `VITE_API_URL=/api/v1`

**Rollback**: 因為是全新建置，rollback 即停止 Docker 服務即可。

## Open Questions

- CPBL 官方有無公開 API 或需要爬蟲？（Phase 2 決定）
- pgAdmin 是否需要設定 SSL？（開發環境暫不需要）
- 廣告版位的曝光/點擊追蹤是否需要即時記錄（本次用 simple counter 即可）
