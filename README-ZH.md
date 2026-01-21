# 🏕️ 露營生活追蹤系統

一個使用 Vue 3 + TypeScript + Tailwind CSS + Supabase 建立的個人露營記錄追蹤網站。

## ✨ 功能特色

- 📊 **統計儀表板**: 顯示總露營次數、總花費、收濕帳次數、最高海拔等統計數據
- 📝 **露營記錄管理**: 完整的 CRUD 功能（新增、查看、編輯、刪除）
- 🗺️ **地圖視圖**: 使用 Leaflet 在地圖上顯示所有營地位置
- 🏷️ **標籤系統**: 下雨、夜衝、收濕帳、大風等快速標籤
- ⭐ **評分系統**: 路況、整潔度、風景評分（1-5分）
- 💰 **費用追蹤**: 記錄每次露營的花費
- 📱 **響應式設計**: 完美支援手機、平板、桌面裝置

## 🛠️ 技術棧

- **Frontend Framework**: Vue 3 (Composition API with `<script setup>`)
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Backend/Database**: Supabase (PostgreSQL)
- **Icons**: Lucide Vue Next
- **Maps**: Leaflet
- **Package Manager**: npm

## 📦 安裝步驟

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定 Supabase

1. 在 [Supabase](https://supabase.com) 創建一個新專案
2. 複製 `.env` 檔案並填入你的 Supabase 憑證：

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 創建資料庫表格

在 Supabase SQL Editor 中執行以下 SQL：

```sql
CREATE TABLE camping_trips (
  id SERIAL PRIMARY KEY,
  trip_date DATE NOT NULL,
  duration_days INTEGER,
  campsite_name TEXT NOT NULL,
  location TEXT,
  altitude NUMERIC,
  road_condition INTEGER,
  cleanliness INTEGER,
  scenery INTEGER,
  entertainment TEXT,
  owner_friendliness TEXT,
  notes TEXT,
  is_windy BOOLEAN DEFAULT FALSE,
  is_rainy BOOLEAN DEFAULT FALSE,
  is_wet_tent BOOLEAN DEFAULT FALSE,
  night_rush BOOLEAN DEFAULT FALSE,
  tent_type TEXT,
  has_tarp BOOLEAN DEFAULT FALSE,
  cost INTEGER DEFAULT 0,
  latitude FLOAT,
  longitude FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. 啟動開發伺服器

```bash
npm run dev
```

應用程式將在 `http://localhost:5173` 啟動。

## 📁 專案結構

```
src/
├── components/
│   ├── StatsHeader.vue      # 統計摘要組件
│   ├── CampingCard.vue      # 露營卡片組件
│   ├── CampingForm.vue      # 表單組件
│   └── MapView.vue          # 地圖組件
├── lib/
│   └── supabase.ts          # Supabase 客戶端設定
├── types/
│   └── database.ts          # TypeScript 類型定義
├── App.vue                  # 主應用程式組件
├── main.ts                  # 應用程式入口
└── style.css                # 全域樣式
```

## 🎨 組件說明

### StatsHeader.vue
顯示露營統計數據的摘要卡片，包括：
- 總露營次數
- 總花費
- 收濕帳次數
- 最高海拔

### CampingCard.vue
展示單筆露營記錄的卡片，包含：
- 營區名稱、日期、天數
- 地點和海拔資訊
- 路況、整潔、風景評分
- 天氣標籤（下雨、夜衝、收濕帳、大風）
- 編輯和刪除按鈕

### CampingForm.vue
新增/編輯露營記錄的表單，支援填寫：
- 基本資訊（營區名稱、日期、地點等）
- 評分（路況、整潔、風景）
- 天氣狀況（下雨、大風、收濕帳、夜衝）
- 裝備資訊（帳篷型號、天幕）
- 其他資訊（費用、娛樂設施、心得備註）
- 地理位置（經緯度）

### MapView.vue
使用 Leaflet 顯示所有營地的地圖視圖，功能包括：
- 在台灣地圖上標記營地位置
- 點擊標記顯示營地詳細資訊
- 自動調整視野包含所有標記

## 🚀 部署

### 建置生產版本

```bash
npm run build
```

建置完成的檔案會在 `dist` 目錄中。

### 部署選項

- **Vercel**: 連接 GitHub 儲存庫自動部署
- **Netlify**: 拖放 `dist` 資料夾或連接 Git
- **Cloudflare Pages**: 使用 Wrangler 部署

記得在部署平台設定環境變數：
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 📝 使用說明

1. **新增記錄**: 點擊右上角「新增露營記錄」按鈕
2. **查看記錄**: 在列表視圖查看所有露營卡片
3. **編輯記錄**: 點擊卡片上的編輯按鈕
4. **刪除記錄**: 點擊卡片上的刪除按鈕（需確認）
5. **切換視圖**: 使用「列表視圖」/「地圖視圖」按鈕切換顯示方式

## 🔒 安全性

- 使用 Supabase Row Level Security (RLS) 保護資料
- API Key 透過環境變數管理，不會暴露在程式碼中
- 建議設定 Supabase 認證以限制存取

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 授權

MIT License

---

打造屬於你的露營記憶！⛺🌲
