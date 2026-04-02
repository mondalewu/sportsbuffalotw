# ad-management

## Purpose

廣告管理：提供廣告版位的 CRUD API，支援 CPD 與 CPM 兩種廣告類型，前端依版位動態載入並渲染廣告內容。

## Requirements

### Requirement: 前端動態載入廣告版位
系統 SHALL 透過 `GET /api/v1/ads?position=<位置>` 提供廣告資料，前端依版位渲染廣告內容（CPD banner 圖片或 CPM script 代碼）。

#### Scenario: 取得側欄廣告版位
- **WHEN** 前端載入首頁，發送 `GET /api/v1/ads?position=sidebar`
- **THEN** API 回傳目前 is_active=true 且在有效日期內的廣告（type、ad_code 或圖片 URL）

#### Scenario: 無有效廣告時
- **WHEN** 某版位無任何 is_active 廣告
- **THEN** API 回傳空陣列，前端不渲染廣告區塊（不顯示空白佔位）

#### Scenario: CPM 代碼廣告渲染
- **WHEN** API 回傳 type 為 CPM 的廣告，含 ad_code 字串
- **THEN** 前端使用 `dangerouslySetInnerHTML` 注入廣告 script 代碼

#### Scenario: CPD 直售廣告渲染
- **WHEN** API 回傳 type 為 CPD 的廣告，含圖片 URL 與連結
- **THEN** 前端渲染 `<a href=...><img src=...></a>` 廣告 banner

### Requirement: Admin 可管理廣告版位
系統 SHALL 提供 `POST /api/v1/ads` 與 `PUT /api/v1/ads/:id` 讓 admin 建立與更新廣告版位。

#### Scenario: 建立新廣告版位
- **WHEN** admin 透過 API 建立廣告，提供 name、type（CPD/CPM）、position、start_date、end_date
- **THEN** 系統建立廣告記錄，回傳 201 與新廣告 id

#### Scenario: 停用廣告版位
- **WHEN** admin 向 `PUT /api/v1/ads/:id` 送出 `{ is_active: false }`
- **THEN** 系統更新 is_active 為 false，該廣告不再透過 GET API 回傳

### Requirement: 廣告版位定義
系統 SHALL 支援以下預定義版位識別碼：

#### Scenario: 支援版位列表
- **WHEN** 系統啟動並執行 seed
- **THEN** 資料庫中存在以下版位的廣告紀錄：`hero`（首頁頂部橫幅）、`sidebar`（文章列表右側）、`article-top`（文章頂部）、`article-bottom`（文章底部）
