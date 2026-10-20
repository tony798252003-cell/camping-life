// 遇到第一個 ｜、| 或前後有空白的連字號就截斷，再 trim
export function cleanCampsiteName(displayName: string): string {
  const idx = displayName.search(/[｜|]|\s-\s/)
  return (idx === -1 ? displayName : displayName.slice(0, idx)).trim()
}
