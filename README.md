# 小遊戲庫

純 HTML + JavaScript 模組，不需要建置工具。程式碼放 GitHub，用 GitHub Pages 發佈；排行榜與對戰用 Supabase。

## 目錄

```
index.html            遊戲庫首頁（讀 shared/games.js 產生卡片）
shared/
  config.js           Supabase 網址與 anon key
  supabase.js         延遲載入 Supabase SDK
  scores.js           排行榜：submitScore()、fetchTopScores()
  player.js           玩家名稱、本機最高分
  ui.js               名稱輸入框、排行榜視窗
  base.css            共用色票與元件
  games.js            遊戲清單
games/tetris/
  engine.js           規則（7-bag、SRS 旋轉、鎖定延遲、垃圾行），不碰 DOM
  render.js           canvas 繪圖
  battle.js           對戰房間（Realtime Presence + Broadcast）
  challenge.js        關卡挑戰：20 關的資料、過關判定、星等，進度存在瀏覽器
  main.js             操作、畫面流程
supabase/
  001_game_library.sql        新排行榜表與 submit_score()，並搬移舊資料
  002_retire_legacy_tables.sql 新版上線後停用舊表
```

## 上線步驟

1. Supabase 後台 → SQL Editor，執行 `supabase/001_game_library.sql`。
2. 推到 GitHub，repo 的 Settings → Pages → Source 選 `main` 分支、`/ (root)`。
3. 打開網站確認排行榜看得到舊資料、玩一局能上傳分數、兩支手機能對戰。
4. 都正常後，執行 `supabase/002_retire_legacy_tables.sql` 關掉舊表權限。

## 本機測試

ES 模組不能直接雙擊 HTML 開啟，要用本機伺服器：

```bash
python -m http.server 5310
```

再開 http://localhost:5310/

## 新增遊戲

1. 建立 `games/<id>/index.html`，引用 `../../shared/base.css`。
2. 在 `shared/games.js` 加一筆。
3. 要排行榜的話，在 `001_game_library.sql` 的 `submit_score()` 加上該遊戲的分數檢查，重新執行一次；前端呼叫 `submitScore('<id>', 名稱, 分數, meta)`。

## 對戰運作方式

- 房號就是 Realtime 頻道名稱 `tetris-room:<房號>`，房間只存在於有人在線時，不寫資料庫。
- 最早進房的人是房主，房主離開時自動換人。
- 盤面每 120ms 最多傳一次，消行時送出垃圾行（2 行→1、3 行→2、4 行→4），會先抵銷自己待收的垃圾行。
