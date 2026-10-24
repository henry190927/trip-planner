# 旅行手帖

手機優先的旅遊行程表。純靜態網頁（Vite + React + TypeScript + Tailwind），PWA 可離線開啟。

## 開發

```bash
npm install
npm run dev      # 終端機會印出 Network 網址，手機連同一個 Wi-Fi 就能開
npm run build    # 產出 dist/
npm run check    # oxlint + 型別 + 單元測試（CI 部署前也會跑）
npm run test:e2e # Playwright，用本機 Chrome 以 iPhone 尺寸跑，截圖在 e2e/screenshots/
```

## 技術選擇

Vite 8 + React + TypeScript + Tailwind CSS v4，動畫用 Motion。另外用了：

- **Zod**：`src/schema.ts` 是資料格式的唯一來源，型別從它推導；`src/trips/trips.test.ts` 用它檢查每個行程檔（時間排序、路線連結、旅伴 id…）
- **Zustand**：「看誰的行程」與清單勾選，存在手機本機
- **Vitest / Playwright / Oxlint**：單元測試、手機尺寸 e2e、lint

刻意沒用：Next.js（純靜態、不需要 SSR）、TanStack Query / MSW（沒有後端 API）、TanStack Router（只有四個分頁，30 行的 hash router 就夠）、shadcn/ui（介面全是自製插畫風元件）、Storybook、Sentry（兩個人用，成本大於效益）。

## 新增一趟旅行

1. 複製 `src/trips/seoul-2026-11.ts` 成新檔（例如 `nagoya-2026-12.ts`），依 `src/types.ts` 的 `Trip` 格式填資料
2. 在 `src/trips/index.ts` 的 `trips` 陣列加進去（並從 `upcoming` 拿掉）
3. `npm run check`：資料寫錯（時間沒排序、routeId 打錯、旅伴 id 不存在）會在這裡被擋下

介面不用改。每趟旅行自己決定時區（`timezone`）、地圖 App（`mapProvider`）、旅伴（`travelers`，可以讓某些項目只屬於某個人）、每天的插圖（`scene`）。

## 部署

push 到 `main` 後，GitHub Actions 會自動 build 並發布到 GitHub Pages
（repo 的 Settings → Pages → Source 要選「GitHub Actions」）。

⚠️ GitHub Pages 是公開網址：不要放訂位代號、護照號碼這類資料。
