# docker-infrastructure

## Purpose

Docker 基礎設施：定義 Docker Compose 服務組態、Vite proxy 設定及環境變數管理，確保本地開發環境可一鍵啟動並正確運作。

## Requirements

### Requirement: Docker Compose 啟動所有服務
系統 SHALL 提供一個 `docker-compose.yml`，執行 `docker compose up` 即可啟動 frontend、backend、db、pgadmin 四個服務。

#### Scenario: 首次啟動
- **WHEN** 在專案根目錄執行 `docker compose up -d`
- **THEN** 四個服務全部啟動，frontend 可於 http://localhost:5173 存取，backend 於 http://localhost:3001，pgAdmin 於 http://localhost:5050

#### Scenario: 資料庫自動初始化
- **WHEN** db 服務首次啟動
- **THEN** PostgreSQL 自動建立 `sports_buffalo` 資料庫，並執行 `init.sql` 初始化 schema

#### Scenario: 服務重啟後資料持久化
- **WHEN** 執行 `docker compose down` 後再次 `docker compose up`
- **THEN** PostgreSQL 資料（文章、比賽等）仍然存在（透過 named volume 持久化）

### Requirement: 前端 Vite Proxy 轉發 API 請求
系統 SHALL 在 `vite.config.ts` 設定 proxy，將 `/api` 前綴的請求轉發至 backend 服務，避免開發環境 CORS 問題。

#### Scenario: API 請求透過 Proxy 轉發
- **WHEN** 前端發送 `GET /api/v1/articles`
- **THEN** Vite dev server 將請求轉發至 `http://backend:3001/api/v1/articles`，前端不直接接觸跨域

### Requirement: 環境變數管理
系統 SHALL 使用 `.env` 檔案管理敏感設定，不將 secrets 提交至版本控制。

#### Scenario: 後端環境變數
- **WHEN** backend 服務啟動
- **THEN** 從環境變數讀取：`DATABASE_URL`、`JWT_SECRET`、`PORT`（預設 3001）

#### Scenario: pgAdmin 預設設定
- **WHEN** pgAdmin 服務啟動
- **THEN** 可以用 `PGADMIN_DEFAULT_EMAIL` 與 `PGADMIN_DEFAULT_PASSWORD` 登入，預設連接 db 服務

### Requirement: 專案目錄結構標準化
系統 SHALL 採用以下目錄結構，讓前後端清楚分離：

#### Scenario: 目錄結構驗證
- **WHEN** 開發者 clone 專案並查看目錄
- **THEN** 看到以下結構：
  ```
  /frontend/        # Vite React App
  /backend/         # Express API
  /docker-compose.yml
  /.env.example     # 環境變數範本
  /README.md
  ```
