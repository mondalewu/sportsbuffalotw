## 1. 專案結構初始化

- [x] 1.1 建立 `frontend/` 目錄，將現有 App.tsx 程式碼遷移至 Vite + React + TypeScript 專案結構
- [x] 1.2 建立 `backend/` 目錄，初始化 Express + TypeScript 專案（package.json、tsconfig.json）
- [x] 1.3 建立根目錄 `.env.example` 與 `.gitignore`（排除 .env、node_modules）
- [x] 1.4 建立根目錄 `README.md`，說明啟動步驟

## 2. Docker 基礎設施

- [x] 2.1 建立 `docker-compose.yml`，定義 frontend、backend、db、pgadmin 四個服務
- [x] 2.2 建立 `backend/Dockerfile`（node:20-alpine，multi-stage build）
- [x] 2.3 建立 `frontend/Dockerfile`（node:20-alpine，Vite dev server）
- [x] 2.4 建立 `backend/src/db/init.sql`，包含 5 張資料表的 CREATE TABLE 語句（users、articles、games、standings、ad_placements）
- [x] 2.5 設定 db 服務掛載 init.sql 至 `/docker-entrypoint-initdb.d/`
- [x] 2.6 設定 named volume `postgres_data` 確保資料持久化
- [x] 2.7 驗證 `docker compose up -d` 能成功啟動所有服務

## 3. 後端 Express 基礎設定

- [x] 3.1 安裝後端依賴：express、pg、jsonwebtoken、bcryptjs、cors、cookie-parser、dotenv（及對應 @types）
- [x] 3.2 建立 `backend/src/index.ts`，設定 Express app、CORS、cookie-parser、JSON middleware
- [x] 3.3 建立 `backend/src/db/pool.ts`，設定 pg Pool 連線（讀取 DATABASE_URL 環境變數）
- [x] 3.4 建立 `backend/src/middleware/auth.ts`，實作 JWT 驗證 middleware（verifyToken、requireRole）
- [x] 3.5 建立 `backend/src/db/seed.ts`，將現有前端 hardcoded WBC 賽程資料插入 games 資料表，加入範例新聞與積分資料
- [x] 3.6 在 package.json 加入 scripts：`dev`（ts-node-dev）、`migrate`（執行 init.sql）、`seed`（執行 seed.ts）

## 4. 會員認證 API（user-auth）

- [x] 4.1 建立 `backend/src/routes/auth.ts`，實作 `POST /api/v1/auth/register`（bcrypt 雜湊密碼，回傳 JWT Cookie）
- [x] 4.2 實作 `POST /api/v1/auth/login`（驗證密碼，設置 httpOnly JWT Cookie，24小時有效）
- [x] 4.3 實作 `POST /api/v1/auth/logout`（清除 JWT Cookie）
- [x] 4.4 實作 `GET /api/v1/auth/me`（驗證 JWT，回傳用戶資訊，排除 password_hash）
- [x] 4.5 在前端導覽列加入登入/登出狀態切換（呼叫 /api/v1/auth/me 初始化狀態）
- [x] 4.6 建立前端登入 Modal 或頁面（email + password 表單，呼叫 POST /api/v1/auth/login）
- [x] 4.7 建立前端註冊 Modal 或頁面（email + username + password 表單）

## 5. 新聞 CMS API（news-cms）

- [x] 5.1 建立 `backend/src/routes/articles.ts`，實作 `GET /api/v1/articles`（支援 ?category=&page=&limit= 查詢參數）
- [x] 5.2 實作 `GET /api/v1/articles/:slug`（取得單篇文章完整內容）
- [x] 5.3 實作 `POST /api/v1/articles`（需 editor+ 角色，自動生成 slug）
- [x] 5.4 實作 `PUT /api/v1/articles/:id`（需 editor+ 角色）
- [x] 5.5 實作 `DELETE /api/v1/articles/:id`（需 editor+ 角色，回傳 204）
- [x] 5.6 前端首頁改為呼叫 `GET /api/v1/articles` 取得新聞列表（移除 initialNewsData hardcoded 資料）
- [x] 5.7 前端後台管理頁「發布文章」改為呼叫 `POST /api/v1/articles`
- [x] 5.8 前端後台管理頁「獲取最新新聞」改為呼叫 `POST /api/v1/articles/fetch-external`

## 6. 賽程與積分榜 API（schedule-standings）

- [x] 6.1 建立 `backend/src/routes/games.ts`，實作 `GET /api/v1/games`（支援 ?league=&status= 查詢參數）
- [x] 6.2 實作 `PUT /api/v1/games/:id`（需 admin 角色，更新比分與狀態）
- [x] 6.3 建立 `backend/src/routes/standings.ts`，實作 `GET /api/v1/standings`（支援 ?league=&season= 查詢參數）
- [x] 6.4 前端比分欄（score bar）改為呼叫 `GET /api/v1/games?status=live` 取得即時比賽
- [x] 6.5 前端 WBSC 賽程頁改為呼叫 `GET /api/v1/games?league=WBC` 取得賽程（移除 wbscSchedule hardcoded）

## 7. 廣告版位 API（ad-management）

- [x] 7.1 建立 `backend/src/routes/ads.ts`，實作 `GET /api/v1/ads`（支援 ?position= 查詢，只回傳 is_active=true 且在有效日期內）
- [x] 7.2 實作 `POST /api/v1/ads`（需 admin 角色）
- [x] 7.3 實作 `PUT /api/v1/ads/:id`（需 admin 角色）
- [x] 7.4 建立前端 `AdBanner` 元件，根據 API 回傳資料動態渲染 CPD 圖片廣告或 CPM script 代碼
- [x] 7.5 在首頁側欄加入 sidebar 廣告版位（呼叫 `GET /api/v1/ads?position=sidebar`）
- [x] 7.6 Seed 資料加入範例廣告版位（sidebar CPM 代碼範例、hero CPD banner 範例）

## 8. 前端重構與 Vite Proxy

- [x] 8.1 在 `frontend/vite.config.ts` 設定 proxy，將 `/api` 轉發至 `http://backend:3001`
- [x] 8.2 安裝前端依賴：axios（或使用 fetch），設定 API base URL 為 `/api/v1`
- [x] 8.3 建立 `frontend/src/api/` 目錄，將各 API 呼叫封裝為 axios 模組（articles.ts、games.ts、auth.ts、ads.ts）
- [x] 8.4 拆分 `App.tsx` 為多個元件目錄（`components/`、`pages/`），每個頁面獨立檔案
- [x] 8.5 確認 RWD 在各頁面正確運作（手機、平板、桌機）

## 9. pgAdmin 設定與驗證

- [x] 9.1 確認 pgAdmin 服務可於 http://localhost:5050 存取
- [x] 9.2 在 pgAdmin 新增 Server 連線至 db 服務（host: db, port: 5432）
- [x] 9.3 在 docker-compose.yml 加入 pgAdmin Server 自動設定（透過 servers.json volume）

## 10. 整合測試與驗收

- [x] 10.1 驗證 `docker compose up -d` 一鍵啟動所有服務無錯誤
- [x] 10.2 驗證會員完整流程：註冊 → 登入 → 取得用戶資訊 → 登出
- [x] 10.3 驗證 editor 可透過後台發布文章，首頁新聞列表即時更新
- [x] 10.4 驗證 WBSC 賽程頁資料來自 API（非 hardcoded）
- [x] 10.5 驗證廣告版位 API 正常回傳，前端 AdBanner 元件正確渲染
- [x] 10.6 驗證 pgAdmin 可連線並查看所有資料表及資料
- [x] 10.7 執行 `docker compose down && docker compose up -d`，確認資料持久化
