# MTT（錦標賽）模式設計

- 日期：2026-11-16
- 狀態：用戶已批准設計
- 原則：現金局完全唔變；MTT 係 session 嘅另一種 `kind`。

## 1. 用戶決定

| 問題 | 決定 |
|---|---|
| 要記乜 | 買入 + 重買／re-entry／add-on；盲注級別隨時升 |
| 唔做 | 完場名次、獎金、盈虧；盲注結構表自動按時間升 |
| Ante | 只支援 BB ante（大盲一人付成張枱嘅 ante） |
| 籌碼 vs 錢 | 枱上一切用比賽籌碼（唔加貨幣符號，加顯示幾多 BB）；session 只顯示「總投入」真錢 |
| 升盲 | 撳「升盲」彈 SB／BB／ante 三格，預填目前級別，自己改完確認 |
| 介面文字 | 中英夾雜，跟現有畫面風格 |

## 2. 資料

Session 新增欄位（舊 session 冇 `kind` 一律當 `'cash'`，唔使 migration）：

```js
{
  kind: 'mtt',                       // 'cash'（預設）| 'mtt'
  buyIn: { prize: 4500, fee: 500 },  // 真錢，session.currency；fee 可以 0
  startingStack: 30000,              // 籌碼
  entries: [                          // 第一個就係開場買入
    { type: 'buyin', amount: 5000, chips: 30000, at: '2026-11-16T12:00:00Z' },
    { type: 'reentry' /* | 'rebuy' | 'addon' */, amount: 5000, chips: 30000, at: '…' },
  ],
  levels: [                           // 最後一個 = 目前級別
    { level: 1, sb: 100, bb: 200, ante: 200, at: '…' },
  ],
  // MTT 唔用：rake, rakeType, rakeMax, jackpot, rakeRound*；game 留空字串
}
```

Hand 新增（只限 MTT）：`blinds: { level, sb, bb, ante }` —— 開手牌時抄低 session 目前級別。之後升盲唔影響舊手牌；編輯舊手牌用返佢自己嘅 `blinds`。

純函數（`src/mtt.js`，新檔）：
- `isMtt(session)`
- `currentLevel(session)` → 最後一個 level
- `totalInvested(session)` → entries amount 總和
- `entrySummary(session)` → 例如「1 buy-in + 1 re-entry」
- `bbCount(chips, bb)` → 四捨五入到 0.1
- `nextLevelDraft(session)` → 預填用：`{ sb, bb, ante }` = 目前級別

## 3. 畫面

### 3.1 SessionSetup
- 頂部 pill：**Cash / MTT**（預設 Cash；記住上次揀咩）。
- MTT 顯示：場地（同現金局共用 venue 選項）、貨幣、Buy-in（Prize + Fee 兩格，Fee 可以空）、Starting stack、Level 1：SB／BB／BB ante、座位數、我嘅座位、開始時間。
- MTT 隱藏：盲注選擇（game）、rake／jackpot 設定、我嘅 stack（用 Starting stack）。
- 儲存：`kind:'mtt'`、`buyIn`、`startingStack`、`entries:[{type:'buyin', amount: prize+fee, chips: startingStack, at}]`、`levels:[{level:1, …}]`、`game:''`。

### 3.2 SessionView
- 標題行：`MTT · Lv3 · 200/400 · ante 400 · 總投入 ₱10,000`。
- **⬆ 升盲**：彈出 SB／BB／ante 三格，預填目前級別；確認後 push `{ level: n+1, …, at: now }`。
- **＋ Re-entry / Rebuy / Add-on**：揀類型，金額預填 buy-in（prize+fee），籌碼預填 starting stack，可以改；push 去 `entries`。
- 座位籌碼顯示：`18,500（46.3 BB）`，唔加貨幣符號。

### 3.3 HandRecorder
- 新手牌：`hand.blinds = currentLevel(session)`；SB／BB 由 `hand.blinds` 嚟（唔再由 `session.game` parse）。
- 底池：BB ante 當死錢 —— 大盲位額外貢獻 `ante`，入主池，唔算入 BB 嘅 call 金額。
- 冇 rake／jackpot。
- 所有金額唔加貨幣符號；底池同淨額旁邊顯示 BB 數。

### 3.4 HandDetail / History
- HandDetail：MTT 手牌顯示籌碼 + BB，標住級別（`Lv3 200/400 (400)`）。
- History：MTT session 標 `MTT`，副標題顯示「總投入 ₱X · 1 buy-in + 1 re-entry」，唔顯示盈虧；現金局統計（總盈虧等）唔計 MTT。

### 3.5 Backup
冇改動 —— session 同 hand 成個 object 備份，新欄位自動包埋。

## 4. 底池計算

`handContributions(hand, sb, bb)` 加第 4 個參數 `ante = 0`：BB 位置貢獻額外加 `ante`（死錢）。`buildPots` 唔使改，因為 ante 計入 BB 嘅總貢獻；但 BB 嘅「已 call 到」金額唔包 ante —— 即係 preflop 冇人加注時 BB check，唔會因為 ante 而要其他人補。

`computeRake`：MTT 一律回 0。

## 5. 測試

- `src/mtt.js` 純函數 unit test（用 repo 現有測試工具；如未有就加 vitest）。
- `handContributions` with ante：BB ante 入池、唔影響 call 金額。
- 現金局 regression：冇 `kind` 嘅 session 同以前一樣。
- 手動：手機開 app，新開 MTT → 升盲 → re-entry → 記一手 → History 睇總投入。

## 6. 唔做

完場名次／獎金／ROI、盲注表自動計時、per-player ante、MTT 統計頁。
