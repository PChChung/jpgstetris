// 關卡挑戰：關卡資料、過關判定、星等與本機進度
//
// goal：lines＝消除 target 行；dig＝清光開局的 garbage 行垃圾；score＝timeLimit 秒內拿到 target 分
// speed：起始速度（同單人模式的等級）；pieceLimit / timeLimit：可省略
// stars：[兩星門檻, 三星門檻]，lines/dig 比用掉的方塊數，score 比花掉的秒數，越少越好
export const LEVELS = [
  { name: '暖身', goal: 'lines', target: 4, speed: 1, stars: [16, 12] },
  { name: '穩穩疊', goal: 'lines', target: 8, speed: 1, stars: [28, 24] },
  { name: '初次挖掘', goal: 'dig', garbage: 2, speed: 1, stars: [8, 5] },
  { name: '精打細算', goal: 'lines', target: 10, pieceLimit: 32, speed: 2, stars: [30, 28] },
  { name: '計時賽', goal: 'score', target: 1500, timeLimit: 60, speed: 2, stars: [45, 30] },
  { name: '挖深一點', goal: 'dig', garbage: 4, speed: 3, stars: [14, 10] },
  { name: '四消入門', goal: 'score', target: 3000, timeLimit: 90, speed: 3, stars: [70, 50] },
  { name: '省著用', goal: 'lines', target: 12, pieceLimit: 37, speed: 3, stars: [35, 33] },
  { name: '地下室', goal: 'dig', garbage: 5, speed: 4, stars: [18, 13] },
  { name: '限時十五行', goal: 'lines', target: 15, timeLimit: 90, speed: 4, stars: [44, 40] },
  { name: '碎石路', goal: 'dig', garbage: 6, speed: 5, stars: [22, 16] },
  { name: '速度與分數', goal: 'score', target: 5000, timeLimit: 120, speed: 5, stars: [95, 75] },
  { name: '長跑', goal: 'lines', target: 20, pieceLimit: 58, speed: 5, stars: [56, 54] },
  { name: '礦坑', goal: 'dig', garbage: 7, speed: 6, stars: [26, 19] },
  { name: '爆發', goal: 'score', target: 4500, timeLimit: 60, speed: 6, stars: [50, 40] },
  { name: '深層挖掘', goal: 'dig', garbage: 8, speed: 7, stars: [30, 22] },
  { name: '極限規劃', goal: 'lines', target: 25, pieceLimit: 72, speed: 7, stars: [69, 66] },
  { name: '高壓', goal: 'score', target: 8000, timeLimit: 150, speed: 8, stars: [120, 100] },
  { name: '地心', goal: 'dig', garbage: 10, speed: 8, stars: [38, 28] },
  { name: '終點', goal: 'lines', target: 40, speed: 10, stars: [110, 104] },
];

const PROGRESS_KEY = 'smallgames.tetris.challenge';

export function loadProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return { stars: data.stars ?? {} };
  } catch {
    return { stars: {} };
  }
}

// 只保留最好的星等
export function saveResult(index, stars) {
  const progress = loadProgress();
  if ((progress.stars[index] ?? 0) >= stars) return progress;
  progress.stars[index] = stars;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // 寫不進去就只在這次有效
  }
  return progress;
}

export function isUnlocked(progress, index) {
  return index === 0 || (progress.stars[index - 1] ?? 0) > 0;
}

export function totalStars(progress) {
  return Object.values(progress.stars).reduce((sum, n) => sum + n, 0);
}

export function starText(n) {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

function formatTime(secs) {
  const s = Math.max(0, Math.ceil(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function describeGoal(level) {
  const limits = [];
  if (level.pieceLimit) limits.push(`限 ${level.pieceLimit} 顆方塊`);
  if (level.timeLimit && level.goal !== 'score') limits.push(`限 ${level.timeLimit} 秒`);
  const suffix = limits.length ? `（${limits.join('、')}）` : '';
  if (level.goal === 'lines') return `消除 ${level.target} 行${suffix}`;
  if (level.goal === 'dig') return `清光底部 ${level.garbage} 行垃圾${suffix}`;
  return `${level.timeLimit} 秒內拿到 ${level.target} 分${suffix}`;
}

export function describeStars(level) {
  const unit = level.goal === 'score' ? '秒內' : '顆方塊內';
  return `★★ ${level.stars[0]} ${unit}\n★★★ ${level.stars[1]} ${unit}`;
}

export function gameOptions(level, index) {
  return { startLevel: level.speed, garbageRows: level.garbage ?? 0, seed: 1000 + index * 7919 };
}

// 回傳目前進度文字與狀態：playing / won / lost
export function evaluate(level, game, elapsedMs) {
  const secs = elapsedMs / 1000;
  let done;
  let progress;
  if (level.goal === 'lines') {
    done = game.lines >= level.target;
    progress = `${Math.min(game.lines, level.target)} / ${level.target} 行`;
  } else if (level.goal === 'dig') {
    const left = game.garbageLeft;
    done = left === 0;
    progress = `剩 ${left} 行`;
  } else {
    done = game.score >= level.target;
    progress = `${game.score} / ${level.target}`;
  }

  const sub = [
    level.pieceLimit ? `方塊 ${game.pieces}/${level.pieceLimit}` : `方塊 ${game.pieces}`,
    level.timeLimit ? `剩 ${formatTime(level.timeLimit - secs)}` : `時間 ${formatTime(secs)}`,
  ].join('<br>');

  if (done) return { status: 'won', progress, sub };
  if (level.pieceLimit && game.pieces >= level.pieceLimit) return { status: 'lost', reason: '方塊用完了', progress, sub };
  if (level.timeLimit && secs >= level.timeLimit) return { status: 'lost', reason: '時間到', progress, sub };
  return { status: 'playing', progress, sub };
}

export function starsFor(level, game, elapsedMs) {
  const metric = level.goal === 'score' ? elapsedMs / 1000 : game.pieces;
  if (metric <= level.stars[1]) return 3;
  if (metric <= level.stars[0]) return 2;
  return 1;
}
