// 星艦防線關卡
// rows：敵機隊形，每列一個字串，. 是空位
//   d 無人機（1 發擊落）  g 砲手（俯衝時會開火）  t 裝甲艇（2 發）  c 指揮艦（3 發，開火是三向散射）
// dive：每隔幾秒派一架出來俯衝；divers：同時俯衝的上限
// fire：開火頻率倍率（0 表示整波都不開火）；speed：俯衝速度倍率
export const LEVELS = [
  { name: '初次接觸', rows: ['..dddd..', '.dddddd.'], dive: 3.2, divers: 1, fire: 0, speed: 0.8 },
  { name: '散開', rows: ['d.d.d.d.', '.d.d.d.d', 'd.d.d.d.'], dive: 2.8, divers: 1, fire: 0, speed: 0.9 },
  { name: '砲火', rows: ['..gggg..', '.dddddd.', 'dddddddd'], dive: 2.6, divers: 2, fire: 0.6, speed: 0.9 },
  { name: '鐵殼', rows: ['.tt..tt.', 'dddddddd', '.dddddd.'], dive: 2.5, divers: 2, fire: 0.6, speed: 1 },
  { name: '人字陣', rows: ['...gg...', '..gddg..', '.dd..dd.', 'dd....dd'], dive: 2.3, divers: 2, fire: 0.8, speed: 1 },
  { name: '指揮艦', rows: ['...cc...', '.gggggg.', 'dddddddd'], dive: 2.2, divers: 2, fire: 0.8, speed: 1 },
  { name: '雙塔', rows: ['tt....tt', 'gg....gg', 'dd.dd.dd', 'dd.dd.dd'], dive: 2.1, divers: 2, fire: 0.9, speed: 1.05 },
  { name: '密集隊形', rows: ['gggggggg', 'dddddddd', 'dddddddd'], dive: 1.9, divers: 3, fire: 0.9, speed: 1.05 },
  { name: '裝甲牆', rows: ['..c..c..', 'tttttttt', '.dddddd.', '..dddd..'], dive: 2, divers: 2, fire: 1, speed: 1.1 },
  { name: '前哨站', rows: ['.c.cc.c.', '.gggggg.', 'tddddddt', 'dddddddd'], dive: 1.8, divers: 3, fire: 1, speed: 1.1 },
  { name: '棋盤', rows: ['g.g.g.g.', '.t.t.t.t', 'd.d.d.d.', '.d.d.d.d', 'd.d.d.d.'], dive: 1.7, divers: 3, fire: 1.1, speed: 1.15 },
  { name: '鉗形攻勢', rows: ['cc....cc', 'gg....gg', 'tt....tt', 'dddddddd'], dive: 1.6, divers: 3, fire: 1.1, speed: 1.15 },
  { name: '鑽石', rows: ['...cc...', '..gttg..', '.gddddg.', '..dddd..', '...dd...'], dive: 1.6, divers: 3, fire: 1.2, speed: 1.2 },
  { name: '彈幕', rows: ['gggggggg', 'gggggggg', 'dddddddd'], dive: 1.5, divers: 3, fire: 1.3, speed: 1.2 },
  { name: '要塞', rows: ['.cccccc.', 'tttttttt', 'tddddddt', 'dddddddd'], dive: 1.5, divers: 3, fire: 1.3, speed: 1.25 },
  { name: '急襲', rows: ['c..cc..c', 'dddddddd', 'dddddddd', 'dddddddd'], dive: 1.2, divers: 4, fire: 1.2, speed: 1.4 },
  { name: '重裝艦隊', rows: ['cccccccc', 'tttttttt', 'gggggggg'], dive: 1.4, divers: 3, fire: 1.4, speed: 1.3 },
  { name: '雙重包夾', rows: ['cc.cc.cc', 'gg.gg.gg', 'tt.tt.tt', 'dd.dd.dd', 'dd.dd.dd'], dive: 1.3, divers: 4, fire: 1.5, speed: 1.35 },
  { name: '主力艦隊', rows: ['.cccccc.', 'gggggggg', 'tttttttt', 'dddddddd', 'dddddddd'], dive: 1.2, divers: 4, fire: 1.6, speed: 1.4 },
  { name: '最終防線', rows: ['cccccccc', 'gggggggg', 'tttttttt', 'gggggggg', 'dddddddd'], dive: 1, divers: 5, fire: 1.8, speed: 1.5 },
];

export function enemyCount(level) {
  return level.rows.join('').replace(/\./g, '').length;
}

export function describeGoal(level) {
  return `擊落全部 ${enemyCount(level)} 架敵機`;
}

export const STAR_RULE = '★★★ 一條命都沒丟\n★★ 最多丟一條命';

// 依失去的生命數給星：0 條 3 星、1 條 2 星，其餘 1 星
export function starsFor(livesLost) {
  return livesLost === 0 ? 3 : livesLost === 1 ? 2 : 1;
}
