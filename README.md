# 水牛體育 SPORTS BUFFALO

台灣最即時的體育新聞平台，專注棒球（CPBL 中職、NPB 日職）與 WBC 世界棒球經典賽。

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 後端 | Express + TypeScript + REST API |
| 資料庫 | PostgreSQL 16 |
| 容器化 | Docker Compose |
| 管理工具 | pgAdmin 4 |

## 快速啟動

### 前置條件
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (啟用 WSL2)

### 步驟

```bash
# 1. 複製環境變數設定
cp .env.example .env
# 編輯 .env，修改密碼等敏感設定

# 2. 啟動所有服務
docker compose up -d

# 3. 初始化資料庫（首次執行）
docker compose exec backend npm run seed

# 4. 開啟瀏覽器
# 前端網站:   http://localhost:5173
# 後端 API:   http://localhost:3001/api/v1
# pgAdmin:    http://localhost:5050
```

## 服務說明

| 服務 | 網址 | 說明 |
|------|------|------|
| frontend | http://localhost:5173 | React 前端網站 |
| backend | http://localhost:3001 | Express REST API |
| pgAdmin | http://localhost:5050 | PostgreSQL 管理介面 |

### pgAdmin 登入
- Email: `admin@sportsbuffalo.com`（預設，可在 .env 修改）
- 密碼: `admin123`（預設，可在 .env 修改）

### 連接資料庫（pgAdmin）
1. 登入 pgAdmin
2. 右鍵 "Servers" → "Register" → "Server"
3. General → Name: `Sports Buffalo DB`
4. Connection → Host: `db` / Port: `5432` / Database: `sports_buffalo` / Username: `postgres`

## API 端點

```
POST   /api/v1/auth/register      # 會員註冊
POST   /api/v1/auth/login         # 登入
POST   /api/v1/auth/logout        # 登出
GET    /api/v1/auth/me            # 取得當前用戶

GET    /api/v1/articles           # 新聞列表 (?category=&page=&limit=)
GET    /api/v1/articles/:slug     # 單篇文章
POST   /api/v1/articles           # 新增文章 [editor+]
PUT    /api/v1/articles/:id       # 更新文章 [editor+]
DELETE /api/v1/articles/:id       # 刪除文章 [editor+]

GET    /api/v1/games              # 賽程/比分 (?league=&status=)
PUT    /api/v1/games/:id          # 更新比分 [admin]
GET    /api/v1/standings          # 積分榜 (?league=&season=)

GET    /api/v1/ads                # 廣告版位 (?position=)
POST   /api/v1/ads                # 新增廣告 [admin]
PUT    /api/v1/ads/:id            # 更新廣告 [admin]
```

## 本機開發（不用 Docker）

```bash
# 後端
cd backend
npm install
npm run dev   # 需要本機 PostgreSQL，設定 .env 的 DATABASE_URL

# 前端
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## 廣告策略

- **CPD 直售**：固定版位合約廣告（hero banner、sidebar）
- **CPM 聯播網**：Google AdSense 等代碼嵌入

## 專案結構

```
cloudecode/
├── frontend/          # Vite + React + TypeScript
│   ├── src/
│   │   ├── api/       # API 呼叫模組
│   │   ├── types/     # TypeScript 型別
│   │   └── App.tsx    # 主應用程式
│   └── Dockerfile
├── backend/           # Express + TypeScript
│   ├── src/
│   │   ├── db/        # DB 連線、migrations、seed
│   │   ├── middleware/ # JWT 認證 middleware
│   │   └── routes/    # API 路由
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```
