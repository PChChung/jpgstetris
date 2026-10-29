// 泡泡連發關卡：盤面由圖形（shape）與上色方式（paint）產生，固定種子，每次重玩都一樣
// rows：開局行數；colors：顏色數；dropEvery：每射幾發天花板下降一格
// shape：full 滿版、funnel 漏斗、center 吊燈、teeth 鋸齒、holes 散洞、arch 拱門、pillars 雙柱
//   泡泡都掛在天花板上，所以圖形只能上寬下窄；沒連到天花板的泡泡開局就會被移除
// paint：clusters 同色成團（預設）、stripes 橫條、columns 直條
export const LEVELS = [
  { name: '入門', rows: 4, colors: 3, shape: 'full', dropEvery: 10 },
  { name: '條紋', rows: 4, colors: 3, shape: 'full', paint: 'stripes', dropEvery: 10 },
  { name: '漏斗', rows: 5, colors: 3, shape: 'funnel', dropEvery: 9 },
  { name: '四色', rows: 5, colors: 4, shape: 'full', dropEvery: 9 },
  { name: '直條', rows: 6, colors: 4, shape: 'full', paint: 'columns', dropEvery: 8 },
  { name: '散洞', rows: 6, colors: 4, shape: 'holes', dropEvery: 8 },
  { name: '吊燈', rows: 6, colors: 4, shape: 'center', dropEvery: 8 },
  { name: '鋸齒', rows: 7, colors: 4, shape: 'teeth', dropEvery: 8 },
  { name: '五色', rows: 6, colors: 5, shape: 'full', dropEvery: 8 },
  { name: '拱門', rows: 7, colors: 5, shape: 'arch', dropEvery: 7 },
  { name: '彩帶', rows: 7, colors: 5, shape: 'full', paint: 'stripes', dropEvery: 7 },
  { name: '雙柱', rows: 8, colors: 5, shape: 'pillars', dropEvery: 7 },
  { name: '密林', rows: 7, colors: 5, shape: 'full', dropEvery: 7 },
  { name: '大漏斗', rows: 8, colors: 5, shape: 'funnel', dropEvery: 7 },
  { name: '六色', rows: 6, colors: 6, shape: 'full', dropEvery: 7 },
  { name: '碎片', rows: 8, colors: 5, shape: 'holes', dropEvery: 6 },
  { name: '大鋸齒', rows: 8, colors: 6, shape: 'teeth', dropEvery: 6 },
  { name: '迴廊', rows: 8, colors: 6, shape: 'arch', dropEvery: 6 },
  { name: '滿版', rows: 8, colors: 6, shape: 'full', dropEvery: 6 },
  { name: '終局', rows: 9, colors: 6, shape: 'full', paint: 'columns', dropEvery: 5 },
];

export function describeGoal(level) {
  return `清光所有泡泡，每 ${level.dropEvery} 發天花板下降一格`;
}

// 星等門檻依開局泡泡數估算：用掉的發數越少越好
export function starLimits(bubbleCount) {
  return [Math.ceil(bubbleCount * 0.65) + 3, Math.ceil(bubbleCount * 0.45) + 2];
}

export function describeStars(limits) {
  return `★★ ${limits[0]} 發內\n★★★ ${limits[1]} 發內`;
}

export function starsFor(limits, shots) {
  if (shots <= limits[1]) return 3;
  if (shots <= limits[0]) return 2;
  return 1;
}
