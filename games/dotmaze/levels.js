// 光點迷宮關卡：迷宮由種子產生（左右對稱），每次重玩都一樣
// patrols：出場的巡邏機，chase 直追、ambush 包抄、wander 亂逛、guard 守地盤
// speed：巡邏機速度倍率；loops：死路打通的比例（越高越好逃）
// batteries：凍結電池數（0–4，放在四個角落）；freeze：凍結秒數
export const LEVELS = [
  { name: '暖身', patrols: ['wander'], speed: 0.75, loops: 1, batteries: 4, freeze: 7 },
  { name: '有人在追', patrols: ['chase'], speed: 0.75, loops: 1, batteries: 4, freeze: 7 },
  { name: '兩台', patrols: ['chase', 'wander'], speed: 0.8, loops: 1, batteries: 4, freeze: 6 },
  { name: '守衛', patrols: ['guard', 'wander'], speed: 0.82, loops: 0.9, batteries: 4, freeze: 6 },
  { name: '包抄', patrols: ['chase', 'ambush'], speed: 0.82, loops: 0.9, batteries: 4, freeze: 6 },
  { name: '三方', patrols: ['chase', 'ambush', 'wander'], speed: 0.85, loops: 0.9, batteries: 4, freeze: 6 },
  { name: '窄路', patrols: ['chase', 'guard'], speed: 0.85, loops: 0.7, batteries: 4, freeze: 6 },
  { name: '巡邏隊', patrols: ['chase', 'ambush', 'guard'], speed: 0.88, loops: 0.85, batteries: 4, freeze: 5 },
  { name: '全員出動', patrols: ['chase', 'ambush', 'wander', 'guard'], speed: 0.84, loops: 0.9, batteries: 4, freeze: 5 },
  { name: '少了電池', patrols: ['chase', 'ambush', 'wander'], speed: 0.9, loops: 0.85, batteries: 2, freeze: 5 },
  { name: '快腳', patrols: ['chase', 'ambush'], speed: 1, loops: 0.8, batteries: 4, freeze: 5 },
  { name: '曲折', patrols: ['chase', 'ambush', 'guard'], speed: 0.92, loops: 0.6, batteries: 4, freeze: 5 },
  { name: '四面八方', patrols: ['chase', 'ambush', 'wander', 'guard'], speed: 0.94, loops: 0.85, batteries: 3, freeze: 4.5 },
  { name: '雙追兵', patrols: ['chase', 'chase', 'ambush'], speed: 0.95, loops: 0.8, batteries: 3, freeze: 4.5 },
  { name: '短暫凍結', patrols: ['chase', 'ambush', 'wander', 'guard'], speed: 0.96, loops: 0.8, batteries: 4, freeze: 3 },
  { name: '迷途', patrols: ['chase', 'ambush', 'guard', 'wander'], speed: 0.98, loops: 0.55, batteries: 3, freeze: 4 },
  { name: '只有兩顆', patrols: ['chase', 'ambush', 'guard', 'wander'], speed: 1, loops: 0.8, batteries: 2, freeze: 4 },
  { name: '高速巡邏', patrols: ['chase', 'ambush', 'wander'], speed: 1.08, loops: 0.8, batteries: 3, freeze: 3.5 },
  { name: '包圍網', patrols: ['chase', 'ambush', 'ambush', 'guard'], speed: 1.04, loops: 0.7, batteries: 2, freeze: 3.5 },
  { name: '終點站', patrols: ['chase', 'chase', 'ambush', 'guard'], speed: 1.1, loops: 0.7, batteries: 2, freeze: 3 },
];

export function describeGoal(level) {
  return `收集所有光點，避開 ${level.patrols.length} 台巡邏機`;
}

export const STAR_RULE = '★★★ 一條命都沒丟\n★★ 最多丟一條命';

export function starsFor(livesLost) {
  return livesLost === 0 ? 3 : livesLost === 1 ? 2 : 1;
}
