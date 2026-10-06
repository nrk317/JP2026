# Cloudflare 版本

Cloudflare Workers 提供網頁及 API，D1 保存共用行程與記帳；GitHub 只存放程式，旅行資料不會寫入公開 repository。

目前程式已準備好，帳號登入與正式部署尚待完成。wrangler.jsonc 的 d1_databases 尚未綁定真實資料庫。

## 首次發布

在 doto-trip 目錄使用官方 Wrangler 工具：

1. `wrangler login` 完成 Cloudflare 帳號授權。
2. `wrangler d1 create jp2026-doto-trip` 建立專案資料庫。
3. 把回傳的資料庫 ID 填入 wrangler.jsonc 的 d1_databases，binding 使用 `DB`、database_name 使用 `jp2026-doto-trip`，migrations_dir 使用 `migrations`。不得使用虛構 ID。
4. `wrangler d1 migrations apply jp2026-doto-trip --remote` 初始化資料庫；往後更新只套用新增 migration，不重設現有資料。
5. `wrangler secret put TRIP_ACCESS_KEY` 設定新的隨機分享金鑰。請勿把金鑰提交至 GitHub、放入 wrangler.jsonc，或沿用聊天中出現的本機測試金鑰。
6. `wrangler deploy` 發布，使用它回傳的 HTTPS 網址加上 `/#key=分享金鑰` 開啟。
7. 驗證兩個裝置的共同編輯、記帳保存與衝突提示後，才把完整連結給旅伴。

## 後續更新

修改 public/ 的介面或 worker.mjs 的資料服務，再發布同一個 Worker。D1 資料庫保持原樣，分享網址不變。下載 JSON 資料備份可保留旅遊紀錄。

目前版本以分享金鑰控制旅行資料存取；持有完整連結者可查看與編輯。網頁外殼是公開的，但旅行 API 未授權回覆 401。

## 狀態

- Worker 語法與 API 授權、衝突、資料格式檢查已完成本地驗證。
- Cloudflare 帳號仍需有效登入；正式部署、D1 遠端驗證尚未完成。
- 免費方案有使用量限制，不會因這份設定自動升級付費方案。
