## ADDED Requirements

### Requirement: 使用者可註冊帳號
系統 SHALL 提供 `POST /api/v1/auth/register` 端點，讓訪客以 email、username、password 建立帳號，密碼須以 bcrypt 雜湊儲存。

#### Scenario: 成功註冊
- **WHEN** 訪客送出含有效 email、username（3-50字）、password（最少8字）的 POST 請求
- **THEN** 系統建立 role 為 member 的用戶，回傳 201 與 JWT access token（httpOnly Cookie）

#### Scenario: Email 已存在
- **WHEN** 使用已存在的 email 註冊
- **THEN** 系統回傳 409 Conflict，訊息「此 Email 已被使用」

#### Scenario: 密碼不足長度
- **WHEN** 密碼少於 8 個字元
- **THEN** 系統回傳 400 Bad Request，訊息「密碼需至少 8 個字元」

### Requirement: 使用者可登入取得 JWT
系統 SHALL 提供 `POST /api/v1/auth/login` 端點，驗證 email 與密碼，成功後設置 httpOnly Cookie 包含 JWT（24小時有效）。

#### Scenario: 成功登入
- **WHEN** 用戶送出正確的 email 與 password
- **THEN** 系統回傳 200，設置 `token` httpOnly Cookie，回傳用戶資訊（id、username、email、role）

#### Scenario: 密碼錯誤
- **WHEN** 用戶送出正確 email 但錯誤 password
- **THEN** 系統回傳 401，訊息「帳號或密碼錯誤」

#### Scenario: Email 不存在
- **WHEN** 用戶送出不存在的 email
- **THEN** 系統回傳 401，訊息「帳號或密碼錯誤」（不揭露 email 是否存在）

### Requirement: 已登入用戶可取得自身資訊
系統 SHALL 提供 `GET /api/v1/auth/me` 端點，驗證 JWT Cookie 後回傳當前用戶資訊。

#### Scenario: 有效 Token 取得用戶資訊
- **WHEN** 含有效 JWT Cookie 的請求送至 `GET /api/v1/auth/me`
- **THEN** 系統回傳 200 與用戶資訊（不含 password_hash）

#### Scenario: 無效或過期 Token
- **WHEN** JWT 已過期或無效
- **THEN** 系統回傳 401，前端清除 Cookie 並導向登入頁

### Requirement: 用戶可登出
系統 SHALL 提供 `POST /api/v1/auth/logout` 清除 JWT Cookie。

#### Scenario: 成功登出
- **WHEN** 已登入用戶送出 POST 至 `/api/v1/auth/logout`
- **THEN** 系統清除 `token` Cookie，回傳 200

### Requirement: 前端導覽列顯示登入狀態
前端 SHALL 根據認證狀態切換顯示「登入」按鈕或「用戶名稱 / 登出」。

#### Scenario: 未登入狀態
- **WHEN** 用戶未登入進入首頁
- **THEN** 導覽列顯示「登入」按鈕

#### Scenario: 已登入狀態
- **WHEN** 用戶已登入（有效 JWT Cookie）
- **THEN** 導覽列顯示用戶 username 與「登出」選項
