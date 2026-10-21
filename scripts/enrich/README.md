# 營區資料補齊（Claude Code 協助）

App 內不使用 AI（`CAMPSITE_AI` 預設 off）。缺的營區欄位由使用者定期請 Claude Code 上網查、補進資料庫。

## 流程（Claude 照做）

1. 列出缺資料的營區：
   `npx tsx scripts/enrich/list-missing.ts --limit 20 [--city 苗栗縣] [--visited] [--json]`
   排序：去過次數多的優先，其次最近建立。
2. 逐間上網查（官網、FB 粉專、可信的露營平台），不確定就留空，不要猜。
3. 把「建議值＋來源網址＋信心」整理給使用者看，**等使用者核准**。
4. 核准後先備份：`npx tsx scripts/backup/backup-all.ts`（exit 0 才繼續）。
5. 用下面的 SQL 寫入（`psql "$DB_URL" -f update.sql`）。只填空欄位，**不覆蓋已有值**，除非使用者明確要求。
6. 每個寫入的欄位在 `field_sources` 記 `{source:'claude', confidence:'high'|'low', urls:[...], confirmed:false}`；App 之後會顯示「Claude 查詢」。

## SQL 範本

`COALESCE`／`CASE` 保證只填空欄位；`field_sources` 用 `||` 合併，只動有寫入的 key。
標籤欄位（陣列）空陣列也算空；文字欄位空字串也算空。

```sql
BEGIN;

UPDATE campsites SET
  check_in_time = CASE WHEN NULLIF(check_in_time, '') IS NULL THEN '14:00' ELSE check_in_time END,
  spot_types    = CASE WHEN COALESCE(array_length(spot_types, 1), 0) = 0 THEN ARRAY['雨棚']::text[] ELSE spot_types END,
  field_sources = COALESCE(field_sources, '{}'::jsonb) || jsonb_build_object(
    'check_in_time', jsonb_build_object('source','claude','confidence','high','urls',jsonb_build_array('https://example.com'),'confirmed',false),
    'spot_types',    jsonb_build_object('source','claude','confidence','low','urls',jsonb_build_array('https://example.com'),'confirmed',false)
  )
WHERE id = 123
  AND merged_into_id IS NULL;

-- 檢查影響列數與結果，沒問題才 COMMIT；有疑慮就 ROLLBACK
SELECT id, check_in_time, spot_types, field_sources FROM campsites WHERE id = 123;

COMMIT;
```

注意：若某欄位本來就有值，上面的 `CASE` 會保留原值，但 `field_sources` 仍會被蓋成 claude；寫入前請只放「實際為空」的欄位的 key。
