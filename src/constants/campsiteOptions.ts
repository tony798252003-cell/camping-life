import type { CapacityZone } from '../types/database'

export const PLAYGROUND_OPTIONS = ['沙坑', '溜滑梯', '盪鞦韆', '遊戲室', '氣墊城堡', '滑草', '彈簧床', '兒童攀岩', '棒球九宮格']
export const WATER_OPTIONS = ['戲水池', '溪流', '河流', '瀑布', '湖泊', '溫泉', '滑水道', '海邊']
export const SCENERY_OPTIONS = ['櫻花', '落羽松', '桐花', '楓葉', '螢火蟲', '雲海', '夜景', '山景', '海景', '湖景', '森林']
export const SPOT_TYPE_OPTIONS = ['草地', '碎石', '草地混碎石', '棧板', '雨棚', '免搭帳', '車邊']
export const ZONE_TYPE_OPTIONS: CapacityZone['type'][] = ['草地', '碎石', '雨棚', '棧板', '其他']
export const BOOKING_METHOD_OPTIONS = ['電話', 'FB', 'Line', '官網']
