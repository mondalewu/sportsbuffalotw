# news-cms

## Purpose

新聞內容管理系統（CMS）：提供 REST API 讓具備適當角色的用戶管理新聞文章，並供前端動態載入新聞列表。

## Requirements

### Requirement: 編輯者可新增新聞文章
系統 SHALL 提供 REST API 讓具備 editor 或 admin 角色的已登入用戶新增新聞文章，欄位包含標題、分類、摘要、內文（Markdown）、封面圖 URL。

#### Scenario: 成功新增文章
- **WHEN** editor 向 `POST /api/v1/articles` 發送含完整欄位的請求（含有效 JWT）
- **THEN** 系統回傳 201，並回傳含 id 與 slug 的新文章物件

#### Scenario: 未登入者無法新增
- **WHEN** 未提供 JWT 的請求送至 `POST /api/v1/articles`
- **THEN** 系統回傳 401 Unauthorized

#### Scenario: 一般會員無法新增
- **WHEN** role 為 member 的 JWT 送至 `POST /api/v1/articles`
- **THEN** 系統回傳 403 Forbidden

### Requirement: 前端首頁動態載入新聞列表
系統 SHALL 透過 `GET /api/v1/articles` API 提供分頁新聞列表，前端不再使用 hardcoded 資料。

#### Scenario: 取得首頁預設新聞列表
- **WHEN** 前端載入首頁，發送 `GET /api/v1/articles?limit=10&page=1`
- **THEN** API 回傳最新 10 筆文章（依 published_at 降序），含 id、title、slug、category、summary、image_url、is_hot、published_at

#### Scenario: 依分類篩選新聞
- **WHEN** 前端發送 `GET /api/v1/articles?category=CPBL`
- **THEN** API 只回傳 category 為 CPBL 的文章

### Requirement: 編輯者可更新與刪除文章
系統 SHALL 允許 editor+ 角色透過 API 更新（PUT）或刪除（DELETE）文章。

#### Scenario: 成功更新文章
- **WHEN** editor 向 `PUT /api/v1/articles/:id` 發送更新欄位（含有效 JWT）
- **THEN** 系統回傳 200 與更新後的文章物件

#### Scenario: 成功刪除文章
- **WHEN** editor 向 `DELETE /api/v1/articles/:id` 發送請求（含有效 JWT）
- **THEN** 系統回傳 204，文章從資料庫移除

### Requirement: 後台管理頁面呼叫真實 API
現有前端後台管理頁（Admin page）SHALL 改為透過 API 進行新聞發布與拉取，取代 mock 資料與 setTimeout 模擬。

#### Scenario: 後台發布新文章
- **WHEN** 編輯者在後台填寫表單並按下「發布」
- **THEN** 前端呼叫 `POST /api/v1/articles`，成功後導回首頁並顯示新文章

#### Scenario: 後台拉取外部新聞（未來擴充點）
- **WHEN** 編輯者點擊「獲取最新新聞」
- **THEN** 系統呼叫後端 `POST /api/v1/articles/fetch-external`，後端負責呼叫外部新聞 API 並存入資料庫
