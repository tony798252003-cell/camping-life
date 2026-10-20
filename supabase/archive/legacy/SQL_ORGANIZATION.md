# SQL Files Organization

## Current SQL Files Status

### Active Migrations (in `/supabase/migrations/`)
- ✅ `20260127_add_tent_selection.sql` -帳篷選擇功能
- ✅ `20260129_add_system_assets.sql` - 系統資產表
- ✅ `20260129_add_tent_brand.sql` - 帳篷品牌欄位
- ✅ `20260129_add_trip_photo_user_id.sql` - 相簿用戶ID# 已整合的 Schema 檔案

### Root SQL Files (Organized)
這些檔案已被整理並記錄用途：

#### 1. **family_rpcs.sql** - 家庭功能相關程序
保留位置: `/supabase/family_rpcs.sql`
用途: Family 相關的 RPC functions (create_family, join_family, leave_family)
狀態: ✅ 保留 (active功能)

#### 2. **photo_gallery.sql** - 相簿功能 Schema
保留位置: `/supabase/photo_gallery.sql`
用途: trip_photos 表建立與 RLS policies
狀態: ✅ 保留 (參考文件)

#### 3. **setup_auth.sql** - 認證初始化
保留位置: `/setup_auth.sql` (root)
用途: Google OAuth 與 Profile 表初始設定
狀態: ✅ 保留 (部署參考)

---

### Deprecated/Redundant Files (建議處理)

#### 已過時的修復檔案 (建議歸檔)
這些檔案是早期的 schema 修正，現在功能已穩定：

- `fix_schema.sql` - 早期修正 (2026-01-21)
- `fix_schema_final.sql` - 中期修正
- `fix_schema_full.sql` - 完整修正版本
- `reload_schema.sql` - Schema 重載
- `repair_family_schema.sql` - Family schema 修復

**建議行動**:
1. 將這些檔案移至 `/supabase/archive/` 資料夾
2. 保留作為歷史參考，但不再主動使用

---

## 推薦的檔案結構

```
supabase/
├── migrations/           # 活躍的資料庫遷移 (時間戳命名)
│   ├── 20260127_xxx.sql
│   └── 20260129_xxx.sql
├── functions/            # (未來) Supabase Edge Functions
├── family_rpcs.sql       # Family RPCs (活躍功能)
├── photo_gallery.sql     # 相簿 schema 參考
└── archive/              # 歷史/已棄用檔案
    ├── fix_schema.sql
    ├── fix_schema_final.sql
    ├── fix_schema_full.sql
    ├── reload_schema.sql
    └── repair_family_schema.sql
```

---

## 執行步驟

已執行的整理:
1. ✅ 識別所有 SQL 檔案並分類
2. ✅ 將舊修復檔案移至 archive 資料夾
3. ✅ 保留活躍的功能性檔案

---

## 注意事項

- migrations/ 裡的檔案使用時間戳命名，便於追蹤執行順序
- 所有新的 schema 變更應建立新的 migration 檔案
- 避免直接修改舊的 migration (保持不可變性)
