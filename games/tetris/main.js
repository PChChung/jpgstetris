import { TetrisGame } from './engine.js';
import { fitCanvas, drawBoard, drawMiniBoard, drawNext } from './render.js';
import { BattleRoom, makeRoomCode } from './battle.js';
import { submitScore } from '../../shared/scores.js';
import { getBestScore, setBestScore, getPlayerName, setPlayerName } from '../../shared/player.js';
import { askName, openLeaderboard } from '../../shared/ui.js';

const GAME_ID = 'tetris';
const COUNTDOWN_MS = 3000;
const STATE_INTERVAL = 120; // 對戰時傳送盤面的最短間隔
const MINI_CELL = 8;

const $ = (id) => document.getElementById(id);
const boardCanvas = $('board');
const boardCtx = boardCanvas.getContext('2d');
const nextCanvas = $('next');
const nextCtx = nextCanvas.getContext('2d');
const oppCtx = $('oppBoard').getContext('2d');

const game = new TetrisGame();
let cellSize = 20;
let renderedVersion = -1;
let mode = 'single';
let running = false;
let paused = false;
let countdown = 0;
let lastTime = 0;
let overlayAction = null;

let room = null;
let round = 0;
let opp = null;
let lastSentVersion = -1;
let lastSentAt = 0;

// ---------- 畫面 ----------

function setVH() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty('--vh', `${h}px`);
}

function resize() {
  setVH();
  requestAnimationFrame(() => {
    const wrap = $('touchArea');
    cellSize = fitCanvas(boardCanvas, wrap.clientWidth - 10, wrap.clientHeight - 10);
    renderedVersion = -1;
  });
}

function render() {
  drawBoard(boardCtx, game, cellSize);
  drawNext(nextCtx, game.nextType, nextCanvas.width, nextCanvas.height);
  $('score').textContent = game.score;
  $('lines').textContent = game.lines;
  $('level').textContent = game.level;
  $('garbageMeter').style.height = `${game.pendingGarbage * cellSize}px`;
}

function drawOpponent() {
  drawMiniBoard(oppCtx, opp?.b, MINI_CELL);
  $('oppName').textContent = opp?.name || '等待中';
  $('oppStats').innerHTML = `分數 ${opp?.s ?? 0}<br>行數 ${opp?.l ?? 0}`;
}

function showOverlay({ title, cls = '', score = null, extra = '', hint = '', action = null }) {
  const titleEl = $('resultTitle');
  titleEl.textContent = title;
  titleEl.className = `resultTitle ${cls}`;
  $('finalScoreLine').classList.toggle('hide', score === null);
  $('finalScore').textContent = score ?? '';
  $('extraScore').textContent = extra;
  $('overlayHint').textContent = hint;
  const btn = $('overlayAction');
  btn.classList.toggle('hide', !action);
  if (action) btn.textContent = action.label;
  overlayAction = action?.run ?? null;
  $('overlay').classList.add('show');
}

function hideOverlay() {
  $('overlay').classList.remove('show');
  overlayAction = null;
}

function setOverlayHint(text, keepAction = true) {
  $('overlayHint').textContent = text;
  if (!keepAction) {
    $('overlayAction').classList.add('hide');
    overlayAction = null;
  }
}

function setModeUI() {
  const battle = mode === 'battle';
  $('oppCard').classList.toggle('hide', !battle);
  $('bestCard').classList.toggle('hide', battle);
  $('restartBtn').disabled = battle;
  $('pauseBtn').disabled = battle;
  $('modeTag').textContent = battle ? `對戰 ${room?.code ?? ''} 第${round}局` : '單人模式';
  $('bestScore').textContent = getBestScore(GAME_ID);
}

function showScreen(name) {
  $('menu').classList.toggle('hide', name !== 'menu');
  $('lobby').classList.toggle('hide', name !== 'lobby');
}

// ---------- 主迴圈 ----------

function frame(t) {
  const dt = lastTime ? t - lastTime : 0;
  lastTime = t;
  if (running && !paused) {
    if (countdown > 0) {
      countdown -= dt;
      if (countdown > 0) showOverlay({ title: String(Math.ceil(countdown / 1000)), cls: 'count' });
      else hideOverlay();
    } else {
      game.update(dt);
    }
  }
  if (game.version !== renderedVersion) {
    renderedVersion = game.version;
    render();
  }
  if (mode === 'battle' && running) maybeSendState(t);
  requestAnimationFrame(frame);
}

function canControl() {
  return running && !paused && countdown <= 0;
}

// ---------- 單人模式 ----------

function startSingle() {
  leaveRoom();
  mode = 'single';
  showScreen(null);
  setModeUI();
  newSingleGame();
}

function newSingleGame() {
  game.reset();
  running = true;
  paused = false;
  countdown = 0;
  $('pauseBtn').textContent = 'Ⅱ';
  hideOverlay();
}

function togglePause() {
  if (mode !== 'single' || !running) return;
  paused = !paused;
  $('pauseBtn').textContent = paused ? '▶' : 'Ⅱ';
  if (paused) showOverlay({ title: '暫停', cls: 'count', hint: '按 ▶ 繼續', action: { label: '繼續', run: togglePause } });
  else hideOverlay();
}

async function finishSingle() {
  const best = getBestScore(GAME_ID);
  const isBest = game.score > best;
  if (isBest) setBestScore(GAME_ID, game.score);
  showOverlay({
    title: 'GAME OVER',
    score: game.score,
    extra: isBest ? `新最高分：${game.score}` : `最高分：${best}`,
    hint: '',
    action: { label: '再玩一次', run: newSingleGame },
  });
  $('bestScore').textContent = getBestScore(GAME_ID);
  await uploadScore();
}

async function uploadScore() {
  if (game.score <= 0) return;
  const result = { score: game.score, lines: game.lines, level: game.level };
  const name = getPlayerName() || await askName({ title: '上傳排行榜', note: '輸入名稱後，這局分數會上傳排行榜。' });
  if (!name) return setOverlayHint('未上傳排行榜');
  setOverlayHint('上傳排行榜中...');
  try {
    await submitScore(GAME_ID, name, result.score, { lines: result.lines, level: result.level });
    setOverlayHint('分數已上傳排行榜');
  } catch (e) {
    setOverlayHint('排行榜上傳失敗：' + e.message);
  }
}

// ---------- 對戰模式 ----------

function lobbyStatus(text) {
  $('lobbyStatus').textContent = text;
}

function showLobby() {
  mode = 'battle';
  running = false;
  hideOverlay();
  showScreen('lobby');
  $('lobbyJoin').classList.toggle('hide', !!room);
  $('lobbyWaiting').classList.toggle('hide', !room);
  $('playerNameInput').value = getPlayerName();
  if (room) {
    $('roomCodeView').textContent = room.code;
    onPlayers(room.players);
  } else {
    lobbyStatus('');
  }
}

async function enterRoom(code, mustExist) {
  const name = setPlayerName($('playerNameInput').value) || '玩家';
  $('createRoom').disabled = $('joinRoom').disabled = true;
  lobbyStatus(mustExist ? '加入房間中...' : '建立房間中...');
  const r = new BattleRoom(code, name);
  room = r;
  r.on('players', onPlayers)
    .on('opponentLeft', onOpponentLeft)
    .on('kicked', (message) => {
      room = null;
      showLobby();
      lobbyStatus(message);
    })
    .on('start', (m) => beginRound(m.round))
    .on('state', (m) => {
      if (m.round !== round || !opp) return;
      Object.assign(opp, { b: m.b, s: m.s, l: m.l });
      drawOpponent();
    })
    .on('attack', (m) => {
      if (m.round === round && running) game.addGarbage(m.n);
    })
    .on('over', onOpponentOver);
  try {
    await r.join({ mustExist });
    showLobby();
  } catch (e) {
    room = null;
    lobbyStatus(e.message);
  } finally {
    $('createRoom').disabled = $('joinRoom').disabled = false;
  }
}

function leaveRoom() {
  room?.leave();
  room = null;
  opp = null;
}

function onPlayers(players) {
  if (!room) return;
  const list = $('playerList');
  list.replaceChildren();
  players.forEach((p, i) => {
    const line = document.createElement('div');
    line.textContent = `${i === 0 ? '👑 ' : '• '}${p.name}${p.id === room.id ? '（你）' : ''}`;
    list.append(line);
  });
  const full = players.length >= 2;
  $('startBattle').classList.toggle('hide', !room.isHost);
  $('startBattle').disabled = !full;
  if (!$('lobby').classList.contains('hide')) {
    if (room.isHost) lobbyStatus(full ? '人數到齊，可以開始遊戲。' : '把房號傳給朋友，等對方加入。');
    else lobbyStatus('等待房主開始遊戲...');
  }
  if (opp && room.opponent) {
    opp.name = room.opponent.name;
    drawOpponent();
  }
}

function hostStart() {
  if (!room?.isHost || room.players.length < 2) return;
  const next = round + 1;
  room.send('start', { round: next });
  beginRound(next);
}

function beginRound(nextRound) {
  if (!room) return;
  round = nextRound;
  mode = 'battle';
  showScreen(null);
  setModeUI();
  game.reset();
  opp = { name: room.opponent?.name ?? '對手', b: null, s: 0, l: 0, over: false };
  drawOpponent();
  running = true;
  paused = false;
  countdown = COUNTDOWN_MS;
  lastSentVersion = -1;
}

function maybeSendState(now) {
  if (game.version === lastSentVersion || now - lastSentAt < STATE_INTERVAL) return;
  sendState();
  lastSentAt = now;
}

function sendState() {
  if (!room) return;
  lastSentVersion = game.version;
  room.send('state', { round, b: game.encode(), s: game.score, l: game.lines });
}

function showBattleResult(win, reason = '') {
  running = false;
  const canRematch = room?.isHost && room.players.length >= 2;
  showOverlay({
    title: win ? 'YOU WIN' : 'GAME OVER',
    cls: win ? 'win' : '',
    score: game.score,
    extra: `對手分數：${opp?.s ?? 0}`,
    hint: reason || (canRematch ? '' : room?.opponent ? '等待房主開始下一局' : '對手已離開房間'),
    action: canRematch ? { label: '再戰一局', run: hostStart } : null,
  });
}

function finishBattle() {
  sendState();
  room?.send('over', { round, score: game.score });
  showBattleResult(false);
}

function onOpponentOver(m) {
  if (m.round !== round || !opp) return;
  opp.over = true;
  opp.s = m.score;
  drawOpponent();
  if (running) showBattleResult(true);
  else $('extraScore').textContent = `對手分數：${opp.s}`;
}

function onOpponentLeft() {
  if (mode !== 'battle') return;
  if (running) showBattleResult(true, '對手已離開房間');
  else if ($('overlay').classList.contains('show')) setOverlayHint('對手已離開房間，按 ‹ 回大廳等新對手', false);
}

// 對戰中按返回視同認輸，回到大廳（仍留在房間）
function backFromGame() {
  if (mode === 'single') {
    running = false;
    hideOverlay();
    showScreen('menu');
    return;
  }
  if (running) {
    sendState();
    room?.send('over', { round, score: game.score });
  }
  showLobby();
}

// ---------- 事件 ----------

game.on('gameover', () => {
  if (mode === 'single') finishSingle();
  else finishBattle();
});
game.on('attack', (rows) => {
  if (mode === 'battle' && room) room.send('attack', { round, n: rows });
});

function openRank() {
  if (mode === 'single' && running && !paused) togglePause();
  openLeaderboard({
    gameId: GAME_ID,
    title: '俄羅斯方塊排行榜',
    formatMeta: (r) => `${r.meta?.lines ?? 0}行 Lv.${r.meta?.level ?? 1}`,
  });
}

// 長按連續移動：先停 170ms 再連發
function bindHold(id, fn, repeat) {
  const el = $(id);
  let timer = null;
  let delay = null;
  const stop = (e) => {
    e?.preventDefault();
    el.classList.remove('holding');
    clearInterval(timer);
    clearTimeout(delay);
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (canControl()) fn();
    el.classList.add('holding');
    clearInterval(timer);
    clearTimeout(delay);
    delay = setTimeout(() => {
      timer = setInterval(() => canControl() && fn(), repeat);
    }, 170);
  }, { passive: false });
  ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture'].forEach((ev) => el.addEventListener(ev, stop, { passive: false }));
}

function bindTap(id, fn) {
  $(id).addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (canControl()) fn();
  }, { passive: false });
}

bindHold('leftBtn', () => game.move(-1), 90);
bindHold('rightBtn', () => game.move(1), 90);
bindHold('downBtn', () => game.softDrop(), 75);
bindTap('rotateBtn', () => game.rotate());
bindTap('dropBtn', () => game.hardDrop());

// 盤面手勢：點一下旋轉、左右滑移動、下滑落下、上滑旋轉
let sx = 0;
let sy = 0;
const touchArea = $('touchArea');
touchArea.addEventListener('pointerdown', (e) => {
  sx = e.clientX;
  sy = e.clientY;
}, { passive: false });
touchArea.addEventListener('pointerup', (e) => {
  if (e.target.closest('button') || !canControl()) return;
  const dx = e.clientX - sx;
  const dy = e.clientY - sy;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (Math.max(adx, ady) < 18) return game.rotate();
  if (adx > ady) {
    const steps = Math.min(3, Math.max(1, Math.round(adx / 42)));
    for (let i = 0; i < steps; i++) game.move(dx > 0 ? 1 : -1);
  } else if (dy > 0) {
    game.hardDrop();
  } else {
    game.rotate();
  }
}, { passive: false });

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const key = e.key.toLowerCase();
  if (key === 'p') return togglePause();
  if (!canControl()) return;
  const actions = {
    arrowleft: () => game.move(-1),
    arrowright: () => game.move(1),
    arrowdown: () => game.softDrop(),
    arrowup: () => game.rotate(),
    ' ': () => game.rotate(),
    x: () => game.rotate(),
    enter: () => game.hardDrop(),
  };
  if (actions[key]) {
    e.preventDefault();
    actions[key]();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'single' && running && !paused) togglePause();
});

$('singleBtn').onclick = startSingle;
$('battleBtn').onclick = showLobby;
$('menuRankBtn').onclick = openRank;
$('rankBtn').onclick = openRank;
$('restartBtn').onclick = () => mode === 'single' && newSingleGame();
$('pauseBtn').onclick = togglePause;
$('backBtn').onclick = backFromGame;
$('overlayAction').onclick = () => overlayAction?.();
$('createRoom').onclick = () => enterRoom(makeRoomCode(), false);
$('joinRoom').onclick = () => {
  const code = $('joinCode').value.trim().toUpperCase();
  if (!code) return lobbyStatus('請輸入房號。');
  enterRoom(code, true);
};
$('startBattle').onclick = hostStart;
$('backMenu').onclick = () => {
  leaveRoom();
  mode = 'single';
  showScreen('menu');
};
$('copyRoom').onclick = async () => {
  const text = room?.code;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    lobbyStatus('房間代碼已複製：' + text);
  } catch {
    lobbyStatus('複製失敗，請手動複製：' + text);
  }
};

window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
window.addEventListener('pagehide', leaveRoom);

setModeUI();
drawOpponent();
resize();
requestAnimationFrame(frame);
