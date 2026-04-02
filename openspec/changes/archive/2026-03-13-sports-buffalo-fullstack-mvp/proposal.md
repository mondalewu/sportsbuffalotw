## Why

「水牛體育 SPORTS BUFFALO」目前是一個所有資料 hardcoded 在前端的 AI Studio 單頁應用，無法持久化內容、無法多人協作編輯、無法進行會員管理，也無法支撐廣告收益模式。現在需要將其升級為具備後端 API、資料庫、會員系統與廣告版位管理的完整全端平台，為未來流量變現與內容擴張打好基礎。

## What Changes

- **新增** Express + TypeScript 後端 API 服務
- **新增** PostgreSQL 資料庫儲存新聞、賽程、會員、廣告資料
- **新增** Docker Compose 容器化部署（前端 + 後端 + PostgreSQL + pgAdmin）
- **新增** 會員系統：註冊、登入、JWT 驗證
- **新增** CMS 新聞管理 API：CRUD 操作，取代前端 mock 資料
- **新增** 賽程/積分榜 API：資料庫驅動，可由後台更新
- **新增** 廣告版位管理系統：CPD 直售為主，CPM 聯播網輔助
- **修改** 前端從 hardcoded 資料改為呼叫後端 REST API
- **修改** 專案結構拆分為 `frontend/` 與 `backend/` 兩個子目錄
- 保留現有 UI 設計風格（Tailwind CSS、黑紅配色）與所有現有頁面

## Capabilities

### New Capabilities

- `news-cms`: 新聞內容管理系統，支援 CRUD、分類、標籤、封面圖，後台編輯介面
- `schedule-standings`: 賽程表與積分榜資料庫模型與 API，支援 CPBL 中職、NPB 日職、WBC
- `user-auth`: 會員系統，含註冊、登入、JWT Token、個人資料頁
- `ad-management`: 廣告版位管理，CPD 直售合約版位 + CPM 聯播網代碼嵌入
- `docker-infrastructure`: Docker Compose 多服務配置，含 pgAdmin 管理介面

### Modified Capabilities

（無現有 spec，全為新建）

## Impact

- **前端**: App.tsx 重構為多檔元件，資料層改為 API 呼叫（fetch/axios）
- **後端**: 新建 Express REST API，路由涵蓋 `/api/news`、`/api/schedule`、`/api/standings`、`/api/auth`、`/api/ads`
- **資料庫**: PostgreSQL schema 新建 5 張核心資料表（users, articles, games, standings, ad_placements）
- **DevOps**: docker-compose.yml 管理 4 個服務（frontend, backend, db, pgadmin）
- **依賴新增**: express, pg, jsonwebtoken, bcryptjs, cors, dotenv（後端）；axios（前端）
