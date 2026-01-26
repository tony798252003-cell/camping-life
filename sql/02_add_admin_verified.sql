-- 1. 更新 Profiles 表格：新增管理員權限
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. 更新 Campsites 表格：新增審核狀態
ALTER TABLE campsites 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- 3. (Optional) 如果有現有資料，預設設為已審核 (假設目前都是手動建立的有效資料)
UPDATE campsites SET is_verified = TRUE WHERE is_verified IS NULL;

-- 4. 權限策略 (RLS) 更新建議
-- 這裡我們開啟 RLS 讓所有人可讀，但前端會過濾 unverified
-- 如果你想更嚴格，可以修改 Select Policy
-- CREATE POLICY "Enable read access for all users" ON campsites FOR SELECT USING (true); -- (Existing)

-- 5. 新增 Policy: 只有本人或管理員可以修改
-- (這部分比較複雜，先手動透過 Supabase Dashboard 設定 'Enable Insert for Authenticated' 即可)
