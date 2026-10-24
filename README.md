# 旅行手帖

手機優先的旅遊行程表。純靜態網頁（Vite + React + TypeScript + Tailwind），PWA 可離線開啟。

## 開發

```bash
npm install
npm run dev      # 終端機會印出 Network 網址，手機連同一個 Wi-Fi 就能開
npm run build    # 產出 dist/
```

## 新增一趟旅行

1. 複製 `src/trips/seoul-2026-11.ts` 成新檔（例如 `nagoya-2026-12.ts`），依 `src/types.ts` 的 `Trip` 格式填資料
2. 在 `src/trips/index.ts` 的 `trips` 陣列加進去（並從 `upcoming` 拿掉）

介面不用改。每趟旅行自己決定時區（`timezone`）、主題色（`theme`）、地圖 App（`mapProvider`）。

## 部署

push 到 `main` 後，GitHub Actions 會自動 build 並發布到 GitHub Pages
（repo 的 Settings → Pages → Source 要選「GitHub Actions」）。

⚠️ GitHub Pages 是公開網址：不要放訂位代號、護照號碼這類資料。
