## ADDED Requirements

### Requirement: API 提供即時比分與賽程資料
系統 SHALL 透過 `GET /api/v1/games` 提供賽程與比分資料，取代前端 hardcoded scoreData 與 wbscSchedule。

#### Scenario: 取得進行中比賽
- **WHEN** 前端發送 `GET /api/v1/games?status=live`
- **THEN** API 回傳所有 status 為 live 的比賽，含 league、team_home、team_away、score_home、score_away、game_detail

#### Scenario: 依聯賽篩選賽程
- **WHEN** 前端發送 `GET /api/v1/games?league=CPBL`
- **THEN** API 只回傳 league 為 CPBL 的比賽資料

#### Scenario: WBC 賽程表查詢
- **WHEN** 前端 WBSC 賽程頁發送 `GET /api/v1/games?league=WBC`
- **THEN** API 回傳所有 WBC 賽程，含 venue、game_date 等完整欄位

### Requirement: API 提供聯賽積分榜
系統 SHALL 透過 `GET /api/v1/standings` 提供各聯賽積分榜資料。

#### Scenario: 取得 CPBL 當季積分榜
- **WHEN** 前端發送 `GET /api/v1/standings?league=CPBL&season=2026`
- **THEN** API 回傳依 rank 升序排列的積分榜，含 team_name、wins、losses、win_rate、games_behind

#### Scenario: 積分榜資料不存在時
- **WHEN** 查詢不存在的聯賽或賽季
- **THEN** API 回傳 200 與空陣列 `[]`

### Requirement: 後台可更新比賽比分與狀態
系統 SHALL 允許 admin 角色透過 API 更新比賽狀態與比分。

#### Scenario: 更新比賽比分
- **WHEN** admin 向 `PUT /api/v1/games/:id` 發送 `{ score_home: 3, score_away: 1, status: "live", game_detail: "7局上" }`
- **THEN** 系統回傳 200 與更新後的比賽資料

### Requirement: 初始 Seed 資料包含現有 hardcoded 內容
系統 SHALL 在 `npm run seed` 執行時將現有前端 hardcoded 的 WBC 賽程資料插入 games 資料表。

#### Scenario: Seed 執行成功
- **WHEN** 執行 `npm run seed`
- **THEN** games 資料表包含現有 wbscSchedule 中所有比賽（Pool A/B/C/D），standings 包含範例積分資料
