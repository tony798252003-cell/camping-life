const fs = require('fs')
const topojson = require('topojson-client')
const d3 = require('d3-geo')
const d3Projection = require('d3-geo-projection')

// 讀取 TopoJSON 檔案
const topoData = JSON.parse(fs.readFileSync('/tmp/taiwan_counties.topojson', 'utf8'))

// 轉換為 GeoJSON
const geojson = topojson.feature(topoData, topoData.objects.layer1)

console.log('Total features:', geojson.features.length)

// 縣市名稱對應表（簡體台字轉繁體臺字，並處理縣市合併）
const nameMapping = {
  '基隆市': '基隆市',
  '台北市': '臺北市',
  '台北縣': '新北市',
  '桃園縣': '桃園市',
  '新竹市': '新竹市',
  '新竹縣': '新竹縣',
  '苗栗縣': '苗栗縣',
  '台中市': '臺中市',
  '台中縣': '臺中市',
  '彰化縣': '彰化縣',
  '南投縣': '南投縣',
  '雲林縣': '雲林縣',
  '嘉義市': '嘉義市',
  '嘉義縣': '嘉義縣',
  '台南市': '臺南市',
  '台南縣': '臺南市',
  '高雄市': '高雄市',
  '高雄縣': '高雄市',
  '屏東縣': '屏東縣',
  '宜蘭縣': '宜蘭縣',
  '花蓮縣': '花蓮縣',
  '台東縣': '臺東縣',
  '澎湖縣': '澎湖縣',
  '金門縣': '金門縣',
  '連江縣': '連江縣'
}

// 按縣市分組 features
const countyGroups = {}
geojson.features.forEach(feature => {
  const countyName = feature.properties.COUNTYNAME || feature.properties.name
  const displayName = nameMapping[countyName] || countyName

  if (!countyGroups[displayName]) {
    countyGroups[displayName] = []
  }
  countyGroups[displayName].push(feature)
})

console.log('Unique counties after grouping:', Object.keys(countyGroups).length)
console.log('Counties:', Object.keys(countyGroups).sort())

// 設定投影
// 使用 Mercator 投影，調整中心點和縮放
// translate 調整為 (300, 320) 以確保金門、馬祖等離島能顯示在 viewBox 內
const projection = d3.geoMercator()
  .center([121, 23.5]) // 台灣中心點
  .scale(6000) // 縮放比例
  .translate([300, 320]) // 平移到合適位置（向右下移動以容納所有離島）

// 建立路徑生成器
const pathGenerator = d3.geoPath().projection(projection)

// 為每個縣市生成合併的 SVG path
const cityPaths = Object.entries(countyGroups).map(([displayName, features]) => {
  // 如果一個縣市有多個 features（多個鄉鎮），合併為 MultiPolygon
  let mergedGeometry

  if (features.length === 1) {
    mergedGeometry = features[0].geometry
  } else {
    // 合併多個幾何形狀
    const coordinates = []
    features.forEach(f => {
      if (!f.geometry) return // 跳過 null geometry

      if (f.geometry.type === 'Polygon') {
        coordinates.push(f.geometry.coordinates)
      } else if (f.geometry.type === 'MultiPolygon') {
        coordinates.push(...f.geometry.coordinates)
      }
    })
    mergedGeometry = {
      type: 'MultiPolygon',
      coordinates: coordinates
    }
  }

  const path = pathGenerator(mergedGeometry)

  return {
    id: displayName,
    name: displayName,
    path: path
  }
}).sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))

// 輸出為 TypeScript 格式
const output = `export interface CityPath {
  id: string // 縣市名稱（與 TAIWAN_LOCATIONS 一致）
  name: string // 顯示名稱
  path: string // SVG path data
}

export const TAIWAN_MAP_PATHS: CityPath[] = ${JSON.stringify(cityPaths, null, 2)}
`

// 寫入檔案
fs.writeFileSync(
  '/Users/tonywang/Documents/Camp/camping-life/.worktrees/glassmorphism-map/src/constants/taiwanMapSvg.ts',
  output,
  'utf8'
)

console.log('✅ Successfully converted and saved to taiwanMapSvg.ts')
console.log(`Generated ${cityPaths.length} county paths`)
