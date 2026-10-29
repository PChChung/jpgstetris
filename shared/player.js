// 玩家名稱與本機最高分。舊版單檔使用的 key 會自動沿用。
const NAME_KEY = 'smallgames.playerName';
const LEGACY_NAME_KEY = 'tetrisPlayerName';
const LEGACY_BEST_KEYS = { tetris: 'tetrisBestScore' };

function read(key, legacyKey) {
  try {
    return localStorage.getItem(key) ?? (legacyKey ? localStorage.getItem(legacyKey) : null);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 無痕模式等情況寫不進去，忽略即可
  }
}

export function cleanName(name) {
  return String(name ?? '').replace(/[<>]/g, '').trim().slice(0, 16);
}

export function getPlayerName() {
  return cleanName(read(NAME_KEY, LEGACY_NAME_KEY));
}

export function setPlayerName(name) {
  const clean = cleanName(name);
  if (clean) write(NAME_KEY, clean);
  return clean;
}

export function getBestScore(gameId) {
  return Number(read(`smallgames.best.${gameId}`, LEGACY_BEST_KEYS[gameId])) || 0;
}

export function setBestScore(gameId, score) {
  write(`smallgames.best.${gameId}`, String(score));
}
