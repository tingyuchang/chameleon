# CLAUDE.md

《The Chameleon 抓包變色龍》繁體中文網頁版。**請用繁體中文跟使用者討論。**

線上版：https://tingyuchang.github.io/chameleon/

## 核心架構決定：零後端

一局的全部資訊編碼在網址的 `#` 片段，由各自手機**本機**解讀。`#` 不會送到伺服器，
所以身分分發不需要資料庫或連線同步。**不要引入 Firebase、建置工具或框架** ——
純 HTML/CSS/原生 JS 直接推 GitHub Pages 是刻意的選擇。

已知取捨（使用者已接受，不用再提）：
- 主持人畫面無法顯示「已加入 4/6 人」，靠口頭確認
- 每局要重新掃一次 QR
- 身分資訊在前端可被解出來 —— 使用者明確說過「桌遊就是開心就好，不用擔心作弊」

## payload 格式與相容性

```
topicId | wordIndex | chameleonSeats | players | startSeat | nonce
夜市小吃   0-15 格子   "2,5" 逗號分隔    人數      起始玩家   每局亂數
```

base64url 編碼放在 `#` 之後。**改動時的鐵律**：

- **不要改欄位順序或新增中間欄位** —— 已發出去的 QR 會解不開
- **不要更動 `data/topics.json` 既有的 `id`** —— 同理
- `chameleonSeats` 單一值（舊格式 `"3"`）必須繼續能解析，已有測試涵蓋
- `nonce` 讓每局網址不同，玩家手機記住的座位號才會在新局自動重置

## 設定都在 data/topics.json

人數範圍、雙變色龍門檻、題庫全在這個檔案，**調整這些不該需要改程式碼**。
新增功能時優先考慮能不能做成 config 欄位。

```json
"config": { "minPlayers": 3, "maxPlayers": 16, "twoChameleonsFrom": 9 }
```

每張主題卡固定 16 個詞，依序對應 4×4 格子（`A1 B1 C1 D1` / `A2 B2 C2 D2` / …）。

## 投影模式

`show()` 會把目前畫面名稱寫進 `body[data-screen]`，CSS 據此換版型。
只有主持人的題目畫面（`board`）解除 560px 寬度限制、字級用 `clamp()` 隨螢幕放大，
其他畫面維持手機版型。字太小就調 `#boardGrid .cell` 的 `clamp()` 上限。

## 雙變色龍的資訊設計

兩隻**互相不知道對方是誰**，但**所有人都被告知本局有幾隻** ——
不講的話投票邏輯會壞（大家投完一隻就以為結束）。改動時別拿掉這個提示。

## 部署

GitHub Pages 直接服務 `main` 的根目錄，沒有 CI，push 後約一分鐘生效。

⚠️ 這台機器的 `gh` CLI 預設帳號是 **dwr-matt**，對這個 repo 沒權限。
需要用 `gh` 操作本 repo 時先 `gh auth switch --user tingyuchang`，**用完切回去**。
（`git push` 走 SSH，不受影響。）

## 用 headless Chrome 驗證畫面

複製 `index.html` 成暫存檔、附加一段自動點擊的 script，再用 Chrome 截圖：

```bash
python3 -m http.server 8000 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1920,1080 --virtual-time-budget=5000 \
  --screenshot=out.png http://localhost:8000/_probe.html
```

**坑**：headless Chrome 的 viewport 最小寬度是 **500px**。指定 `--window-size=390`
會得到一張 390px 寬、但內容其實是 500px 版面的裁切圖，看起來像版面爆掉 —— 那是假象。
要量實際寬度就把 `getBoundingClientRect()` 寫進 `document.title` 再 `--dump-dom` 抓出來。

暫存的 `_*.html` 記得刪掉，不要 commit。
