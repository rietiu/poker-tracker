# MTT：盲注記喺手牌、preflop 後手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** MTT 嘅盲注（SB／BB／BB ante）改為「每手牌記」，唔再喺開場或者場中升盲掣度記；記 preflop 動作時可以選填每個玩家嘅後手籌碼，並按嗰手嘅 BB 顯示幾多個 BB。

**Why（用戶 2026-11-17）：** 「大小盲不是記在 starting session 那，是記在手牌那。記 preflop action 時可能連後手要交代。配合盲注級別就知道是幾個 bb。」

**Tech Stack:** React 19 + Vite、IndexedDB、vitest（`npx vitest run`）。現有 211 個 test、lint baseline 9 errors（唔可以增加）。

## Global Constraints

- 現金局完全唔變。
- MTT session 唔再有「Level 1 盲注」輸入同「⬆ 升盲」掣；`entries`（買入／重買）同「Re-entry / Rebuy / Add-on」掣、總投入顯示保留。
- 舊 MTT session（已經有 `levels` 欄位）要繼續行：佢哋最後一個 level 只係用嚟做「第一手預填」嘅後備。
- 每手 MTT 牌 `hand.blinds = { sb, bb, ante }`（`level` 欄位可有可無；舊手牌有 `level`）。開新手牌時預填：同場上一手牌嘅 blinds → 冇就舊 `levels` 最後一級 → 冇就空白。BB 必須 > 0 先可以繼續。
- 後手：`hand.stacks = { [position]: chips }`，只記 preflop 開始前嘅籌碼，選填；顯示用 `bbCount(chips, hand.blinds.bb)`（小數後一位），枱上用籌碼，唔加貨幣符號。
- 介面文字中英夾雜，同現有畫面一致。
- Commit 尾加：
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_014GsBHcP2FgPGyBssELtVGV`

---

### Task 1: mtt.js、SessionSetup、SessionView 去掉場級盲注

**Files:** `src/mtt.js`、`test/mtt.test.js`、`src/screens/SessionSetup.jsx`、`src/screens/SessionView.jsx`

- [ ] `src/mtt.js`：
  - 新增 `lastHandBlinds(session, hands)`：回傳同 session 最近一手（按 `handNum` 或 `createdAt`）有 `blinds` 嘅 `{sb, bb, ante}`；冇就用 `currentLevel(session)` 去掉 `level`；再冇就 `{sb:'', bb:'', ante:''}`。
  - `handBlinds(session, hand)`：MTT 時優先 `hand.blinds`，其次 `currentLevel(session)`，最後 `{sb:0,bb:0,ante:0}`（保持現有行為）。
  - `levelLabel(b)`：冇 `level` 就唔寫 `Lv`，顯示 `200/400 (400)`；有 `level` 就同以前一樣（舊手牌）。
  - `nextLevelDraft` 保留（舊 test 要過），唔再被畫面用。
- [ ] `test/mtt.test.js`：加 `lastHandBlinds` 同無 level 嘅 `levelLabel` test（先寫、見 RED、再實作）。
- [ ] `SessionSetup.jsx`：MTT 去掉「Level 1 盲注」三格、`lv` state、`updateLv`；開始掣條件改為 `Number(buyPrize) > 0 && Number(startingStack) > 0`；儲存 MTT session 時唔再寫 `levels`（`entries` 照寫）。
- [ ] `SessionView.jsx`：
  - 去掉「⬆ 升盲」掣、升盲面板同 `confirmLevel`；保留 Re-entry 掣同面板。
  - 標題第二行：有手牌時顯示最近一手盲注 `MTT · 最近一手 200/400 (400) · 6-handed · started …`；未有手牌顯示 `MTT · 盲注喺每手牌記 · …`。
  - 座位籌碼嘅 BB 數用最近一手嘅 BB（`lastHandBlinds(...).bb`），冇就唔顯示 BB。
- [ ] 驗證：`npx vitest run && npm run build && npm run lint`（lint 唔可以多過 9 個錯誤）。
- [ ] Commit：`feat(mtt): blinds are no longer set per session — they are recorded on each hand`

### Task 2: HandRecorder 每手牌輸入盲注

**Files:** `src/screens/HandRecorder.jsx`

- [ ] 現有 `handLevel`/`setHandLevel`/`existingBlinds` 邏輯改為：MTT 時 `hand.blinds` 係手牌自己嘅欄位（draft 同最終儲存都帶；edit 舊手牌保留原本 blinds，舊手牌冇 blinds 就用 `handBlinds` 嘅後備）。
- [ ] Step 0（My Position）頂部，只限 MTT，加一行三格 `SB` / `BB` / `BB ante`：
  - 新手牌預填 `lastHandBlinds(session, sessionHands)`（`init()` 已經 load `getHandsBySession`）；
  - 輸入時即時更新 `sb`/`bb`/`ante` state（所有底池、淨額、`preflopStartPot` 計算跟住變）；
  - `BB` 空或 0 時，「Next」disabled（現有 `canNext` 邏輯 step 0）；
  - 加細字提示「盲注記喺呢手牌」。
- [ ] 現金局 step 0 完全唔變。
- [ ] 驗證同上；手動檢查（如果可以用 headless Chromium 驅動 `npx vite preview`，請行一手：開 MTT session → Record Hand → 見到三格預填空白 → 填 100/200/200 → Next 啟用；第二手預填 100/200/200）。
- [ ] Commit：`feat(mtt): blinds are entered on each hand`

### Task 3: Preflop 後手（stacks）

**Files:** `src/screens/HandRecorder.jsx`、`src/screens/HandDetail.jsx`、可能 `src/components/PositionSequencer.jsx`（優先唔改，用 HandRecorder 內嘅獨立面板）

- [ ] `hand.stacks`：`{ [pos]: Number }`，初始 `{}`；draft 同最終儲存都帶；edit 舊手牌保留。
- [ ] Step 2（Pre-flop）sequencer 下面，只限 MTT，加可摺疊面板「後手 Stacks（選填）」：列出 `hand.myPosition` 同 preflop 已經有動作嘅位置（動作變化時列表跟住變，唔刪走已輸入嘅值），每行一格籌碼輸入 + 右邊顯示 `{bbCount(stack, bb)} BB`；自己嗰行標 `You`。留空 = 唔記。
- [ ] `HandDetail.jsx`：MTT 手牌有 `stacks` 時，喺 preflop 動作附近顯示 `後手：BTN 7,500 (25 BB) · BB 12,000 (30 BB)`（只列有值嘅）；冇就唔顯示。
- [ ] 現金局完全唔變。
- [ ] 驗證同上；手動檢查（headless 可行就行：記一手 preflop，填兩個後手，儲存後喺 HandDetail 見到）。
- [ ] Commit：`feat(mtt): optional preflop stacks per position, shown in BB`

### Task 4: 驗證、merge

- [ ] `npx vitest run && npm run build && npm run lint`（lint ≤ 9）。
- [ ] 用戶確認先 merge `feat/mtt-hand-blinds` 入 `main` 同 push（GitHub Pages 自動 deploy）。
